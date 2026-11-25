# Análise de Contexto, Framework Cynefin e Abordagem de Gestão

## 1. Contextualização do Projeto

O projeto **CodeWear** consiste na refatoração e migração de uma arquitetura monolítica para microsserviços orientados a eventos e contextos delimitados (DDD) utilizando NestJS, mantendo a compatibilidade e integração com o front-end existente.

## 2. Análise de Contexto via Framework Cynefin

* **Sistema Legado (Domínio Complexo / Caótico):** A estrutura monolítica anterior apresentava forte acoplamento e dependências ocultas, resultando em baixa previsibilidade de mudanças e alto risco em modificações.
* **Nova Arquitetura NestJS (Domínio Complicado):** Com a separação em microsserviços (Autenticação, Catálogo, Carrinho e Pedidos), o projeto foi posicionado no domínio **Complicado** (*Complicated*). Nesse domínio, as relações de causa e efeito são analisáveis por especialistas através de boas práticas de engenharia de software, testes e padrões arquiteturais claros.

## 3. Justificativa da Abordagem de Gestão (Ágil / Scrum)

A adoção do método **Scrum** fundamenta-se na necessidade de gerenciar a transição arquitetural de forma incremental e segura:

* **Product Backlog e User Stories:** Requisitos estruturados na forma de User Stories (`US01` a `US06`) contendo critérios de aceite rigorosos e testáveis.
* **Rastreabilidade End-to-End:** Integração direta entre o Jira e o GitHub, associando commits e pull requests diretamente aos tickets (`SCRUM-5` a `SCRUM-10`).
* **Ciclo de Vida e Versionamento:** Controle de lançamentos parciais de software estruturados através de Semantic Versioning (`v1.0.0`).
