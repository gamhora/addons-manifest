export interface Env {
  GITHUB_PAT: string
  GITHUB_OWNER?: string
  GITHUB_REPO?: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Health check endpoint
    if (request.method === 'GET') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          service: 'Metric Addons Marketplace Registry Worker',
          timestamp: new Date().toISOString(),
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

      // 1. Faz o download do manifest.yaml a partir da URL do repositório do dev
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

      const owner = env.GITHUB_OWNER || 'gamhora'
      const repo = env.GITHUB_REPO || 'addons-manifest'
      const filePath = `addons/${addonId}.yaml`
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`

      // 2. Consulta se o arquivo já existe no repo para obter o SHA anterior (necessário para update)
      let fileSha: string | undefined = undefined
      const checkFileRes = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${env.GITHUB_PAT}`,
          'User-Agent': 'Metric-Addons-Registry-Worker',
          Accept: 'application/vnd.github.v3+json',
        },
      })

      if (checkFileRes.ok) {
        const fileJson = (await checkFileRes.json()) as { sha?: string }
        fileSha = fileJson.sha
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
          'User-Agent': 'Metric-Addons-Registry-Worker',
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
