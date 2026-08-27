# 🛡️ TODO: Diretrizes e Travas de Segurança do Marketplace (Registry Worker)

Este documento mapeia os vetores de ataque identificados no pipeline de publicação automática e especifica as 3 travas de segurança obrigatórias a serem implementadas no **Cloudflare Ingestion Worker** (`src/index.ts`).

---

## 🎯 Objetivo
Garantir que desenvolvedores da comunidade possam publicar e atualizar seus addons de forma 100% autônoma e sem necessidade de tokens, **sem que nenhum usuário mal-intencionado consiga sequestrar, adulterar ou sobrescrever addons de outros autores**.

---

## 🚨 Vetores de Ataque Mapeados

1. **Tentativa de Sequestro (Addon Hijacking / Impersonation):**
   - *Cenário:* O usuário `hacker123` envia um payload com `addonId: "gustavohps10-redmine"` apontando para `manifestUrl: "https://raw.githubusercontent.com/hacker123/malicious/main/manifest.yaml"`.
   - *Risco:* Sobrescrever o binário `.tladdon` oficial de um autor legítimo na vitrine da loja por um binário infectado.

2. **Tentativa de Spoofing de Namespace:**
   - *Cenário:* Um terceiro tenta publicar um plugin com prefixo reservado (ex: `metric-core`, `gamhora-auth`) para induzir o usuário ao erro.

3. **Injeção de URLs Externas Suspeitas:**
   - *Cenário:* O `downloadUrl` ou `iconUrl` aponta para servidores não confiáveis fora do GitHub Releases.

---

## 🔒 As 3 Travas Obrigatórias a Implementar no Worker

### 1. Validação Estrita de Namespace (`autor-addon`)
* **Regra:** O `addonId` **deve obrigatoriamente iniciar com o username/organização** do GitHub extraído da `manifestUrl`.
* **Exemplo de Validação:**
  - `manifestUrl`: `https://raw.githubusercontent.com/Gustavohps10/redmine-plugin/...`
  - Usuário extraído da URL: `gustavohps10`
  - Prefixo obrigatório do ID: `gustavohps10-*`
  - Se o `addonId` for `outro-autor-redmine` $\rightarrow$ **Rejeitar com HTTP 403 (Invalid Namespace)**.

---

### 2. Trava de Autoria e Origem Vitalícia (Source Repository Lock)
* **Regra:** No primeiro registro de um addon, o Worker grava a chave imutável `ownerRepo` (ex: `Gustavohps10/redmine-plugin`).
* **Em qualquer atualização subsequente (Update/Release):**
  - O Worker consulta o arquivo existente em `addons/<addon-id>.yaml`.
  - Verifica se a nova `manifestUrl` pertence exatamente ao mesmo repositório do registro original.
  - Se outro repositório tentar atualizar o mesmo addon $\rightarrow$ **Rejeitar com HTTP 403 (Unauthorized Source Repository)**.

---

### 3. Validação de Domínio de Download (`downloadUrl` & Checksum)
* **Regra:** O campo `downloadUrl` do `.tladdon` deve obrigatoriamente:
  - Pertencer ao domínio oficial de releases: `https://github.com/<owner>/<repo>/releases/download/...`
  - Conter a extensão obrigatória `.tladdon`.
  - Conter versão semântica compatível com a tag de lançamento.

---

## 📋 Checklist de Tarefas Técnicas

- [ ] Atualizar `addons-manifest/src/index.ts` com o parser de URL do GitHub (`extractGitHubOwnerRepo`).
- [ ] Implementar verificação de namespace no Worker antes de processar o download do manifesto.
- [ ] Implementar trava de checagem do repositório original em arquivos já existentes.
- [ ] Adicionar testes automatizados no Worker simulando tentativas de sobrescrita cruzada (Cross-Author Hijack).
