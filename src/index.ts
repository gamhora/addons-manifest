export interface Env {
  GITHUB_PAT: string
  GITHUB_OWNER?: string
  GITHUB_REPO?: string
}

function extractGitHubInfo(urlStr: string): { owner: string; repo: string } | null {
  try {
    const url = new URL(urlStr)
    // raw.githubusercontent.com/<owner>/<repo>/<branch>/...
    if (url.hostname === 'raw.githubusercontent.com') {
      const parts = url.pathname.split('/').filter(Boolean)
      if (parts.length >= 2) {
        return { owner: parts[0], repo: parts[1] }
      }
    }
    // github.com/<owner>/<repo>/raw/<branch>/...
    if (url.hostname === 'github.com') {
      const parts = url.pathname.split('/').filter(Boolean)
      if (parts.length >= 2) {
        return { owner: parts[0], repo: parts[1] }
      }
    }
    return null
  } catch {
    return null
  }
}

function extractYamlField(yaml: string, field: string): string | null {
  const regex = new RegExp(`^\\s*${field}\\s*:\\s*(?:['"]?)([^'"\\r\\n]+?)(?:['"]?)\\s*$`, 'm')
  const match = yaml.match(regex)
  return match ? match[1].trim() : null
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Health check endpoint
    if (request.method === 'GET') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          service: 'Mr. Tick Addons Marketplace Registry Worker',
          timestamp: new Date().toISOString(),
          version: '1.1.0-secure',
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 405,
      })
    }

    try {
      if (!env.GITHUB_PAT) {
        return new Response(
          JSON.stringify({
            error:
              'GITHUB_PAT não configurado nas Environment Variables do Cloudflare Worker.',
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 500 },
        )
      }

      const body = (await request.json()) as {
        addonId?: string
        manifestUrl?: string
      }
      const rawAddonId = body?.addonId?.trim()
      const manifestUrl = body?.manifestUrl?.trim()

      if (!rawAddonId || !manifestUrl) {
        return new Response(
          JSON.stringify({
            error: 'addonId e manifestUrl são campos obrigatórios.',
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 400 },
        )
      }

      // Sanitização de segurança do ID (apenas letras, números, _ e -)
      const addonId = rawAddonId.replace(/[^a-zA-Z0-9_-]/g, '')
      if (!addonId) {
        return new Response(
          JSON.stringify({ error: 'addonId com formato inválido.' }),
          { headers: { 'Content-Type': 'application/json' }, status: 400 },
        )
      }

      // 🔒 SEGURANÇA 1: Extração e validação do repositório GitHub de origem
      const ghInfo = extractGitHubInfo(manifestUrl)
      if (!ghInfo) {
        return new Response(
          JSON.stringify({
            error:
              'manifestUrl inválida: deve apontar para uma URL raw oficial do GitHub (ex: https://raw.githubusercontent.com/usuario/repo/main/manifest.yaml).',
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 400 },
        )
      }

      // 🔒 SEGURANÇA 2: Namespace Lock (addonId deve obrigatoriamente iniciar com o username/org do GitHub)
      const expectedPrefix = `${ghInfo.owner.toLowerCase()}-`
      if (!addonId.toLowerCase().startsWith(expectedPrefix)) {
        return new Response(
          JSON.stringify({
            error: `Namespace inválido: o addonId '${addonId}' deve iniciar com o prefixo obrigatório '${expectedPrefix}' baseado no autor '${ghInfo.owner}'.`,
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 403 },
        )
      }

      // 1. Faz o download do manifest.yaml a partir da URL oficial do repositório
      const manifestRes = await fetch(manifestUrl)
      if (!manifestRes.ok) {
        return new Response(
          JSON.stringify({
            error: `Não foi possível baixar o manifesto de: ${manifestUrl} (HTTP ${manifestRes.status})`,
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 400 },
        )
      }

      const manifestContent = await manifestRes.text()
      if (!manifestContent || manifestContent.trim().length === 0) {
        return new Response(
          JSON.stringify({ error: 'O manifesto baixado está vazio.' }),
          { headers: { 'Content-Type': 'application/json' }, status: 400 },
        )
      }

      // 🔒 SEGURANÇA 3: Validação da integridade interna do manifesto
      const yamlId = extractYamlField(manifestContent, 'id')
      if (yamlId && yamlId.toLowerCase() !== addonId.toLowerCase()) {
        return new Response(
          JSON.stringify({
            error: `Inconsistência no manifesto: o id no arquivo YAML ('${yamlId}') não coincide com o addonId ('${addonId}').`,
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 400 },
        )
      }

      const downloadUrl = extractYamlField(manifestContent, 'downloadUrl')
      if (!downloadUrl) {
        return new Response(
          JSON.stringify({
            error: 'Manifesto inválido: campo obrigatório downloadUrl não encontrado.',
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 400 },
        )
      }

      // Validação de domínio de download (deve ser release do repositório e extensão .tladdon)
      const expectedReleasePrefix = `https://github.com/${ghInfo.owner}/${ghInfo.repo}/releases/download/`.toLowerCase()
      if (
        !downloadUrl.toLowerCase().startsWith(expectedReleasePrefix) ||
        !downloadUrl.toLowerCase().endsWith('.tladdon')
      ) {
        return new Response(
          JSON.stringify({
            error: `downloadUrl não autorizada: o binário deve ser uma release oficial hospedada em '${expectedReleasePrefix}...' e possuir a extensão '.tladdon'.`,
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 400 },
        )
      }

      const owner = env.GITHUB_OWNER || 'mistertick'
      const repo = env.GITHUB_REPO || 'addons-manifest'
      const filePath = `addons/${addonId}.yaml`
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`

      // 2. Consulta se o arquivo já existe no catálogo
      let fileSha: string | undefined = undefined
      const checkFileRes = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${env.GITHUB_PAT}`,
          'User-Agent': 'Mistertick-Addons-Registry-Worker',
          Accept: 'application/vnd.github.v3+json',
        },
      })

      if (checkFileRes.ok) {
        const fileJson = (await checkFileRes.json()) as { sha?: string; content?: string }
        fileSha = fileJson.sha

        // 🔒 SEGURANÇA 4: Source Repository Lock (Prevenção de Sequestro / Addon Hijacking)
        if (fileJson.content) {
          try {
            const existingYaml = atob(fileJson.content.replace(/\s/g, ''))
            const existingSourceUrl = extractYamlField(existingYaml, 'sourceUrl')
            if (existingSourceUrl) {
              const existingGh = extractGitHubInfo(existingSourceUrl)
              if (existingGh) {
                const incomingRepo = `${ghInfo.owner}/${ghInfo.repo}`.toLowerCase()
                const existingRepo = `${existingGh.owner}/${existingGh.repo}`.toLowerCase()
                if (incomingRepo !== existingRepo) {
                  return new Response(
                    JSON.stringify({
                      error: `Acesso negado (Source Repository Lock): o addon '${addonId}' pertence ao repositório '${existingGh.owner}/${existingGh.repo}' e não pode ser sobrescrito por '${ghInfo.owner}/${ghInfo.repo}'.`,
                    }),
                    { headers: { 'Content-Type': 'application/json' }, status: 403 },
                  )
                }
              }
            }
          } catch {
            // Em caso de falha no decode, prossegue
          }
        }
      }

      // Converte o conteúdo do YAML para Base64 (suportando caracteres UTF-8)
      const utf8Bytes = new TextEncoder().encode(manifestContent)
      let binaryString = ''
      for (let i = 0; i < utf8Bytes.length; i++) {
        binaryString += String.fromCharCode(utf8Bytes[i])
      }
      const base64Content = btoa(binaryString)

      // 3. Grava / Atualiza o arquivo direto na branch main
      const commitRes = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${env.GITHUB_PAT}`,
          'User-Agent': 'Mistertick-Addons-Registry-Worker',
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `chore(store): auto-publish addon ${addonId}`,
          content: base64Content,
          branch: 'main',
          sha: fileSha,
        }),
      })

      if (!commitRes.ok) {
        const errDetails = await commitRes.text()
        return new Response(
          JSON.stringify({
            error: 'Erro ao commitar no repositório GitHub',
            details: errDetails,
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 500 },
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Addon ${addonId} publicado com sucesso no repositório ${owner}/${repo}!`,
        }),
        { headers: { 'Content-Type': 'application/json' }, status: 200 },
      )
    } catch (err: any) {
      return new Response(
        JSON.stringify({
          error: 'Erro interno no Worker',
          details: err?.message || String(err),
        }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 },
      )
    }
  },
}
