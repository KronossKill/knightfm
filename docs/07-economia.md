# 07 — Economía

## La moneda: $Knight

- Moneda única del juego con **puente a Solana**: depósitos verificados on-chain (`solana.rpc.url`, mint y wallet del sistema configurables) y retiros con mínimo configurable (`solana.minWithdraw`, default 50).
- Precio $Knight→USD: configurable (`economy.knightUsdCents`) o automático desde `solana.price.url`; snapshots históricos en `PriceSnapshot`; el equivalente USD se muestra junto a los precios del juego.
- **Depósitos desde Solana: SIN gravamen** (mandato del usuario, Task 16).

## Flujo de fondos

```
Depósito Solana ─────────────────────► PersonalWallet (0% gravamen)
PersonalWallet ── INVEST ────────────► Club.operatingFund (0% gravamen)
Club.operatingFund ── WITHDRAW ──────► PersonalWallet (clubWithdrawTaxPct, 10%)
PersonalWallet ── RETIRO CRIPTO ─────► Solana (withdrawalLevyPct, 10%)
```

## Gravámenes (todos configurables, van al fondo SYSTEM)

| Gravamen | Clave | Default | Aplica a |
|---|---|---|---|
| Ingresos de usuario | `economy.userFundsLevyPct` | 10% | Salario de mánager, bono de referido, ingresos de venta de club |
| Ingresos de club | `economy.clubIncomeTaxPct` | 10% | Premios, ventas de jugadores, taquilla, fees de cesión |
| Retiro club→cartera | `economy.clubWithdrawTaxPct` | 10% | Extracciones del propietario |
| Retiro a cripto | `economy.withdrawalLevyPct` | 10% | Cash-out $Knight→Solana |

Exentos: depósitos Solana, inversiones cartera→club, reembolsos de subasta, subvenciones del admin.

## Reparto de ingresos del mundo

Cada ingreso del mundo se reparte: `revenueRegionalPct` (5%) al fondo de la región + `revenueSystemPct` (5%) al fondo SYSTEM; el resto al origen.

## Salarios

- **Jugadores**: diario = `playerSalaryRatePct` (1%) del valor BASE de mercado (antes del multiplicador ×3) — las nóminas escala con la plantilla.
- **Cobro**: semanal (`finance.salaryIntervalDays`, 7 días) con fondos del club.
- **Mánager**: contrato base `managerBaseContract` (140) + primas; duración = días restantes de la temporada.
- **Staff**: salario diario por estrellas (1★→3 … 5★→40).

## Valor de mercado y cláusulas

- `marketValue = base(ovr, edad) × market.playerValueMultiplier (3)`.
- `salary` y costes derivan de la base; `releaseClause = valor × releaseClauseMultiplier (5)`.
- Pagar la cláusula de un jugador de OTRO club: el importe va al club vendedor (con gravamen de ingresos de club), el jugador cambia de club.

## Mercados de pases (todos con pisos configurables)

| Mercado | Reglas |
|---|---|
| **Subastas** | Piso 20% del valor; pujas con reserva de fondos; ganador paga, perdedores liberados |
| **Venta directa** | Piso 100%; compra instantánea |
| **Cláusulas** | Lista de ejercibles de otros clubes |
| **Agentes libres** | Pool de 40 (`market.freeAgentPoolSize`) con rotación 24 h |
| **Cesiones** | SIEMPRE duran hasta el final de la temporada (mandato); fee al club cedente, salario a cargo del cesionario |
| **Ofertas a mánagers** | Clubes del sistema ofertan a mánagers sin club (`managerOfferDays` 7) |
| **Venta de clubes** | Propietario-a-propietario; venta al sistema paga el 90% |

## Quiebra y préstamos

- Insolvencia (`insolventDays` 3) sin fondos para nóminas → estado de alerta; `bankruptcyDays` (10) → liquidación controlada.
- Préstamos con multiplicador de devolución (`repaymentMultiplier` ×2).

## Premios por victoria (diferenciados y configurables)

| Competición | Premio por partido ganado |
|---|---|
| Liga | `winPrizeLeague` 80 (±10% por división: `winPrizeDivisionStepPct`) |
| Copa regional | `winPrizeCup` 120 — con escala por ronda (k/N) si `winPrizeCupRoundScale`; el campeón recibe `prizeCupBase` 2500 |
| Mundial | `winPrizeWorld` 250 (fase de grupos paga 25%: `winPrizeWorldGroupPct`); campeón `prizeWorldBase` 10000 |

Campeones de liga/copas/mundial otorgan títulos duraderos al club (visible en el palmarés).

## Referidos

`referral.bonus` (100) al validar el referido — con gravamen de ingresos de usuario. `referralCredited` evita dobles pagos.

## Anti-abuso económico

- Fondos reservados al pujar (no se pueden pujar dos veces el mismo saldo).
- Pisos de mercado impiden dump por debajo de valor.
- Todos los movimientos pasan por `LedgerEntry` (libro mayor auditable del club) y los sensibles por `AuditEvent`.
- El admin puede inyectar fondos a una wallet (`/api/admin/funds`) con auditoría.
