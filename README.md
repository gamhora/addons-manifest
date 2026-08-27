# 🏪 Metric Addons Registry

Repositório central do catálogo oficial de Addons (Plugins) para o **Metric App**.

---

## 🚀 Como funciona a Loja de Addons

```text
┌──────────────────────────┐       ┌──────────────────────────┐       ┌──────────────────────────┐
│  📦 Repositório do Dev   │       │  🏪 addons-manifest Repo │       │   💻 Metric Desktop App  │
│  (ex: redmine-plugin)    │       │  (Este Repositório)      │       │                          │
│                          │       │                          │       │                          │
│ • Tag Git v0.1.0         │──────>│ • Recebe PR com manifesto│──────>│ • Lê o index.json        │
│ • Gera .tladdon          │       │ • Compila o index.json   │       │ • Exibe na Loja de Addons│
│ • Abre PR automático     │       │ • Publica na GitHub Pages│       │ • Instala com 1 clique   │
└──────────────────────────┘       └──────────────────────────┘       └──────────────────────────┘
```

---

## 📝 Como publicar seu Addon

1. Crie seu Addon utilizando o template oficial de referência: [Gustavohps10/redmine-plugin](https://github.com/Gustavohps10/redmine-plugin).
2. Configure o workflow de CI/CD para gerar releases automáticas de `.tladdon`.
3. Adicione o arquivo de manifesto do seu Addon dentro da pasta `addons/`:
   - Nome do arquivo padronizado: `addons/<seu-usuario-github>-<nome-do-addon>.yaml` (Ex: `addons/gustavohps10-redmine.yaml`).
4. Abra um Pull Request contra a branch `main` deste repositório.
5. Quando o PR for aceito e mergeado, o catálogo `index.json` será automaticamente reconstruído e disponibilizado no Metric App!

---

## ⚙️ Estrutura do Manifesto (`manifest.yaml`)

```yaml
id: gustavohps10-redmine
name: Redmine
version: 0.1.0
categories:
  - dataSource
author: Gustavo Henrique
shortDescription: Redmine data source for projects and issues
description: Integration with Redmine to fetch projects, issues, users, and time entries
iconUrl: https://raw.githubusercontent.com/Gustavohps10/redmine-plugin/main/src/icon.png
sourceUrl: https://github.com/Gustavohps10/redmine-plugin
homepage: https://github.com/Gustavohps10/redmine-plugin#readme
tags:
  - redmine
  - datasource
  - time-entries
screenshots:
  - url: https://raw.githubusercontent.com/Gustavohps10/redmine-plugin/main/screenshots/screenshot-1.png
    caption: Interface Principal
downloadUrl: https://github.com/Gustavohps10/redmine-plugin/releases/download/v0.1.0/gustavohps10-redmine-0.1.0.tladdon
requiredApiVersion: '>=0.1.0'
releaseDate: '2026-08-26'
changelog:
  - Release 0.1.0
```
