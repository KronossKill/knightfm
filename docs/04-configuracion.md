# 04 — Configuración (113 claves editables por el administrador)

Todas las claves viven en `ConfigKey` (`defaultValue` + `currentValue` + min/max + locked) y se editan desde **Centro de Control → Configuración** (o `PUT /api/admin/config`). El genesis las siembra de `CONFIG_DEFAULTS` (`src/lib/config.ts`); los resets del mundo NO pierden los valores editados.

## World
| Clave | Default | Descripción |
|---|---|---|
| `world.epoch.utc` | (genesis) | Época del mundo UTC; GameDay = 1 + floor((UTC−epoch)/24h). locked |
| `world.seasonStartOffsetDays` | 5 (min 5, max 60) | Días entre el RESET y el día 1 competitivo de la T1 |
| `world.regions` / `world.divisionsPerRegion` / `world.clubsPerDivision` | 10 / 10 / 16 | Geografía del mundo (locked) |
| `world.autoCreateDivision` | true | Crear división si una región se llena |
| `world.pickMinDivisionIndex` | 5 | Los nuevos usuarios solo pueden elegir divisiones ≥ 5 |

## Competition
| Clave | Default |
|---|---|
| `season.competitiveDays` / `season.preseasonDays` | 32 / 5 |
| `competition.leagueCompleteByDay` / `cupFinalDay` / `worldCupFinalDay` | 28 / 29 / 30 |
| `competition.kickoffHourUtc` / `kickoffRegionStaggerMinutes` / `kickoffMinuteJitter` | 19 / 90 / 20 |
| `competition.promotionSlots` / `relegationSlots` / `worldCupSlots` | 3 / 3 / 3 |
| `competition.prizeLeagueBase` / `prizeCupBase` / `prizeWorldBase` | 5000 / 2500 / 10000 |
| `competition.winPrizeLeague` / `winPrizeCup` / `winPrizeWorld` | 80 / 120 / 250 |
| `competition.winPrizeDivisionStepPct` / `winPrizeWorldGroupPct` | 10 / 25 |
| `competition.winPrizeCupRoundScale` | true (rondas de copa escalan k/N; el campeón recibe `prizeCupBase`) |

> El **Mundial de Clubes se disputa desde la Temporada 2** (mandato del usuario: en T1 no hay clasificados).

## Economy
| Clave | Default | Descripción |
|---|---|---|
| `economy.clubStartingFund` | 1000 | Fondo operativo de TODO club en genesis/reset |
| `economy.playerSalaryRatePct` | 1 | Salario diario = % del valor BASE del jugador |
| `economy.releaseClauseMultiplier` | 5 | Cláusula = 5 × valor de mercado |
| `economy.userFundsLevyPct` | 10 | Gravamen sobre INGRESOS de usuario (salario mánager, referidos, venta de club) |
| `economy.withdrawalLevyPct` | 10 | Gravamen sobre retiros a cripto |
| `economy.clubIncomeTaxPct` | 10 | Gravamen sobre INGRESOS del club (premios, ventas, taquilla, cesiones) |
| `economy.clubWithdrawTaxPct` | 10 | Gravamen club→cartera del propietario |
| `economy.revenueRegionalPct` / `revenueSystemPct` | 5 / 5 | Reparto de ingresos del mundo |
| `economy.systemClubPrice` | 100 | Precio base de un club del sistema |
| `economy.managerBaseContract` | 140 | Salario base del contrato de mánager |
| `economy.insolventDays` / `bankruptcyDays` / `repaymentMultiplier` | 3 / 10 / 2 | Quiebra y préstamos |
| `economy.knightUsdCents` | 0 | Precio $Knight→USD (0 = automático desde `solana.price.url`) |
| `finance.salaryIntervalDays` | 7 | Salarios semanales |
| `referral.bonus` | 100 | Bono de referido (con gravamen de ingresos) |

## Markets
| Clave | Default |
|---|---|
| `market.directSaleFloorPct` / `auctionFloorPct` | 100 / 20 |
| `market.freeAgentPoolSize` | 40 (rotación 24 h) |
| `market.playerValueMultiplier` | 3 (valor = base × 3; salarios desde base) |
| `market.managerOfferDays` | 7 |

## Players / Squad / Matches
| Clave | Default |
|---|---|
| `squad.baseCapacity` / `maxBonusSlots` | 25 / 20 |
| `squad.icpTraining/Medical/Youth/ScienceWeight` | 30 / 25 / 25 / 20 (ICP = índice de capacidad de plantilla) |
| `players.retirementAgeOutfield` / `retirementAgeGk` | 36 / 40 |
| `players.youthPromotionAge` | 18 |
| `matches.redCardChancePct` / `redCardSuspensionMatches` | 5 / 2 |
| `matches.yellowCardChancePct` / `yellowCardMaxPerMatch` / `yellowCardsForSuspension` | 40 / 4 / 5 |

## Youth
| Clave | Default |
|---|---|
| `youth.baseCapacity` / `capacityPerLevel` | 3 / 2 (capacidad = ojeos simultáneos) |
| `youth.maxProspectsPool` | 50 |
| `youth.academyQualityCapBase` / `academyQualityCapPerLevel` | 40 / 10 (tope de calidad firmable) |

## Admin access / Operations
| Clave | Default |
|---|---|
| `admin.bootstrapEmail` | Valor de `ADMIN_BOOTSTRAP_EMAIL` (emails que nacen ADMIN al registrarse) |
| `ops.maintenanceMode` / `ops.maintenanceMessage` | false / "Knight FM is under maintenance…" |

## Facilities
| Clave | Default |
|---|---|
| `facilities.maxLevel` / `upgradeDays` | 10 / 5 |
| `facilities.baseCost` | 80 (escala por nivel) |
| `facilities.restRecoveryPerLevel` | 2 (recuperación extra por nivel de Descansos) |

## Training (fórmula multi-factor)
| Clave | Default |
|---|---|
| `training.generalSessionsPerDay` / `specialPerTypePerDay` | 1 / 1 |
| `training.weight.condition/age/quality/coach/facility` | 100 ×5 (pesos de la fórmula) |
| `training.growthFactor` | 100 |
| `training.generalAttrPct` / `specialAttrPct` | 1 / 3 (% de mejora por sesión) |

## Staff
| Clave | Default |
|---|---|
| `staff.maxPerRole` / `hireCostPerQuality` / `severanceMultiplier` | 3 / 2 / 1 |
| `staff.starFee.1…5` | 50 / 100 / 200 / 350 / 600 (coste de fichaje) |
| `staff.starSalary.1…5` | 3 / 6 / 12 / 22 / 40 (salario diario) |

## Security
| Clave | Default | Descripción |
|---|---|---|
| `users.inactiveAfterDays` / `users.deleteAfterDays` | 40 / 60 | Ciclo de vida de cuentas |
| `security.captchaProvider` | sandbox | Proveedor de captcha |
| `security.loginLockoutAttempts` / `loginLockoutMinutes` | 5 / 15 | Lockout de login |
| `security.vpnDetectUrl` | (vacío) | Endpoint del detector VPN/proxy |
| `security.vpnPolicy` | log_only | `log_only` \| `BLOCK` (bloquea login/registro desde VPN) |
| `security.ipWindowDays` | 30 | **Ventana de la regla anti-multicuenta** (1..365) |
| `security.ipMultiAccountPolicy` | BLOCK | `BLOCK` \| `OFF` — 2 cuentas en la misma IP en la ventana ⇒ bloqueo automático de todas |

## Solana
| Clave | Default |
|---|---|
| `solana.rpc.url` / `solana.mint` / `solana.systemWallet` | (vacíos — configurar para producción) |
| `solana.minWithdraw` | 50 (mínimo de retiro configurable) |
| `solana.price.url` / `solana.finalityMinutes` | (vacío) / 60 |
