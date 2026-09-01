# 🏪 Mr. Tick Addons Registry

Repositório central do catálogo oficial de Addons (Plugins) para o **Mr. Tick App**.

---

## 🚀 Arquitetura de Publicação Automática (Marketplace Pipeline)

O Mr. Tick possui um pipeline de ingestão **100% autônomo e contínuo**, sem necessidade de forks manuais ou tokens para desenvolvedores da comunidade:

```text
┌────────────────────────────────┐       ┌────────────────────────────────┐       ┌────────────────────────────────┐
│  📦 Repositório do Dev        │       │  ⚡ Cloudflare Ingestion Worker │       │  🏪 addons-manifest Repo       │
│  (ex: redmine-plugin)          │       │  (mistertick.workers.dev)        │       │  (Este Repositório)            │
│                                │       │                                │       │                                │
│ • Desenvolve com @mr-tick/sdk  │       │ • Recebe POST automático       │       │ • Salva em addons/<id>.yaml    │
│ • git tag v0.1.0 && push       │──────>│ • Valida e extrai o manifesto  │──────>│ • generate-index.yml compila   │
│ • CI gera release com .tladdon │       │ • Grava direto na branch main  │       │ • index.json atualizado no ar! │
└────────────────────────────────┘       └────────────────────────────────┘       └────────────────────────────────┘
                                                                                              │
                                                                                              ▼
                                                                              ┌────────────────────────────────┐
                                                                              │    💻 Mr. Tick Desktop App     │
                                                                              │  • Lê o index.json remoto      │
                                                                              │  • Exibe nova versão na Loja   │
                                                                              │  • Instalação com 1 clique     │
                                                                              └────────────────────────────────┘
```

---

## 📝 Como Publicar um Addon (Guia Rápido para Desenvolvedores)

### 1. Criar o Projeto
Utilize o repositório de referência oficial como modelo:
👉 **[Gustavohps10/redmine-plugin](https://github.com/Gustavohps10/redmine-plugin)**

### 2. Configurar o Manifesto (`manifest.yaml`)
Na raiz do seu plugin, configure o `manifest.yaml`:

```yaml
id: seuusuario-nomeaddon
name: Nome do Addon
version: 0.1.0
categories:
  - dataSource
author: Seu Nome
shortDescription: Resumo curto de 1 linha para a vitrine
description: Descrição completa detalhando recursos do addon
iconUrl: https://raw.githubusercontent.com/seuusuario/seurepo/main/src/icon.png
sourceUrl: https://github.com/seuusuario/seurepo
homepage: https://github.com/seuusuario/seurepo#readme
tags:
  - time-tracking
  - datasource
screenshots:
  - url: https://raw.githubusercontent.com/seuusuario/seurepo/main/screenshots/overview.png
    caption: Tela Principal
downloadUrl: https://github.com/seuusuario/seurepo/releases/download/v0.1.0/seuusuario-nomeaddon-0.1.0.tladdon
requiredApiVersion: '>=0.1.0'
releaseDate: '2026-08-27'
changelog:
  - Versão inicial
packages:
  - version: 0.1.0
    requiredApiVersion: '>=0.1.0'
    releaseDate: '2026-08-27'
    downloadUrl: https://github.com/seuusuario/seurepo/releases/download/v0.1.0/seuusuario-nomeaddon-0.1.0.tladdon
    changelog:
      - Versão inicial
```

### 3. Publicar uma Nova Versão
No repositório do seu Addon, basta criar e enviar uma tag Git:

```bash
git tag v0.1.0
git push origin main --tags
```

O workflow de CI/CD do plugin compilará o pacote `.tladdon`, criará a Release no GitHub e notificará o endpoint oficial do Mr. Tick (`https://addons-manifest.mistertick.workers.dev/`). Em menos de **30 segundos**, o plugin estará disponível na vitrine oficial do Mr. Tick App!

---

## 🌐 Endpoint de Ingestão do Catálogo

- **URL:** `https://addons-manifest.mistertick.workers.dev/`
- **Método:** `POST`
- **Headers:** `Content-Type: application/json`
- **Body:**
  ```json
  {
    "addonId": "seuusuario-nomeaddon",
    "manifestUrl": "https://raw.githubusercontent.com/seuusuario/seurepo/main/manifest.yaml"
  }
  ```

---

## 🛠️ Manutenção do Repositório

- Os arquivos de cada addon vivem individualmente em `addons/<addon-id>.yaml`.
- Toda alteração na pasta `addons/**` dispara o workflow [`.github/workflows/generate-index.yml`](.github/workflows/generate-index.yml), que consolida todos os manifestos no arquivo `index.json` na raiz.
