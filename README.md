# Placa Limpa 🚗🔗

Registro de **ciclo de vida veicular na Solana**. A montadora minta o veículo, emissores credenciados
(oficina, vistoriador, seguradora) anexam **eventos assinados**, e o comprador **verifica o histórico**
numa página pública. Dado sensível é cifrado off-chain com abertura **3-de-5** (Shamir); na chain só
entram o **hash** e a prova de quem atestou o quê e quando.

> 🔗 **Demo ao vivo (devnet):** https://placa-limpa.vercel.app
> Bounty Superteam · TDC Floripa 2026.

## O que blockchain faz aqui (com honestidade)

Não existe programa custom. O log append-only **já é** o ledger da Solana: cada evento é uma transação
assinada, ordenada, com timestamp de consenso, **impossível de apagar ou reordenar**. A regra
"hodômetro não retrocede" é validada no cliente — então a fraude **não é bloqueada, é registrada para
sempre**. A página de verificação marca a inconsistência em **vermelho, permanente**. Blockchain aqui é
**detecção e não-repúdio**, não prevenção.

## Crypto-shredding & LGPD

O dado sensível só existe **cifrado** (AES-256-GCM). A chave é dividida em 5 partes (Shamir), 3 abrem.
No **`/cofre`** você escolhe um registro real, cola **3 shares**, reconstrói a chave e **lê o dado** — e o
app confere que `sha256(dado) == hash` do memo on-chain. Se o titular pede exclusão (art. 18, LGPD),
**destrói-se a chave** → o dado morre, mesmo com o hash imutável na chain, que não reidentifica ninguém.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS v4
- **Metaplex Core** (via `umi`) para o NFT do veículo + atributos
- **SPL Memo** + `getSignaturesForAddress` para o log de eventos
- **@solana/wallet-adapter** (Phantom) para assinar
- `shamir-secret-sharing` + Web Crypto (AES-GCM)
- **SQLite** embutido (`node:sqlite`) para o índice e o dado cifrado off-chain
- **Vitest** — 100% de cobertura da lógica de negócio (lib + rotas de API)

## Base local (SQLite)

O que **não** vai na chain fica numa base local SQLite versionada em `data/placa-limpa.db`:

- **`veiculos`** — índice `vinCommit → asset` (a chain não indexa por atributo; é como a verificação acha o asset).
- **`emissores`** — credencial off-chain do emissor (pubkey, CNPJ, escopo).
- **`dados_sensiveis`** — o **ciphertext** + as **5 shares** Shamir de cada evento, indexado pelo **mesmo `hash`** do memo. `DELETE` = crypto-shredding.

> A timeline dos eventos **não** vem do banco — vem sempre da chain (`getSignaturesForAddress`). O banco
> é só índice + dado off-chain.
>
> ⚠️ Na Vercel o FS é read-only em runtime: o `.db` semeado é **lido**, mas escrita ao vivo não persiste.
> Localmente (`npm run dev`) a escrita persiste normal. Para escrita em produção, migrar para **Turso** (libsql).

APIs: `/api/veiculos`, `/api/emissores`, `/api/dados`, `/api/commit` (sha256(chassi+PEPPER), não expõe o VIN).

## Telas

| Rota | O quê |
|---|---|
| `/` | Landing |
| `/verificar` | Lista os veículos registrados → verificação real (dados da chain) |
| `/montadora` | Mint do veículo (Core NFT) |
| `/oficina` | Registra evento (memo tx + atributo + ciphertext off-chain) |
| `/v/[commit]` | ⭐ Verificação pública — timeline + selo + **alerta vermelho** |
| `/cofre` | 3-de-5: escolhe um registro real, cola 3 shares → **lê o dado** + confere o hash; "destruir a chave" (LGPD) |

## Como rodar

```bash
cp .env.example .env.local   # preencha NEXT_PUBLIC_RPC e VIN_PEPPER
npm install
npm run dev                  # http://localhost:3000
```

Com `NEXT_PUBLIC_MOCK=1`, `/v/demo` mostra um veículo com inconsistência (sem tocar a chain). Para os
**dados reais on-chain**, use `NEXT_PUBLIC_MOCK=0` e vá em `/verificar`. Para escrever: conecte a
**Phantom em devnet** em `/montadora` ou `/oficina`.

## Testes & cobertura

```bash
npm test        # vitest run --coverage — gate de 100%
```

Gera o relatório **LCOV** em `coverage/lcov.info` — cobertura **por linha com contagem de execuções**
(formato padrão de mercado, consumido por ferramentas e pelo gate). É **local, não versionado**.
Cobertura atual: **100%** de statements, branches, funções e linhas.

## Deploy (Vercel)

Import direto deste repositório (o app está na **raiz**). Variáveis: `NEXT_PUBLIC_RPC`, `VIN_PEPPER`,
`NEXT_PUBLIC_COLLECTION` (vazio) e **`NEXT_PUBLIC_MOCK=0`**.

## Endereços da devnet

Carteira montadora (mint authority): `AENk2DB1xKpi3Urs8UJgqk5BWLA25Xqruz8eJMF9VFJP`.

| Veículo | Asset | Verificar |
|---|---|---|
| Íntegro | [`GEEb1wEHnxoNhJrbDSKVyejPJCNXQBP59yLHgYVGBmZn`](https://solscan.io/account/GEEb1wEHnxoNhJrbDSKVyejPJCNXQBP59yLHgYVGBmZn?cluster=devnet) | [`/v/55136e…`](https://placa-limpa.vercel.app/v/55136edccd343d8c49981ae7368db66dfaa1c26b8d42399871dbf40f7ae1051b) |
| Fraudado (⚠️ 80.000→45.000) | [`FgfrTMEKfLQni6PnVPdBCt6MDBH5LDhMppJBzLX8nT6M`](https://solscan.io/account/FgfrTMEKfLQni6PnVPdBCt6MDBH5LDhMppJBzLX8nT6M?cluster=devnet) | [`/v/b2bb24…`](https://placa-limpa.vercel.app/v/b2bb2440b6c53c6ea978db3f74ec8b4da978d6f03662e7e4761748ae6cc2be43) |

## Licença

MIT — ver [LICENSE](LICENSE).
