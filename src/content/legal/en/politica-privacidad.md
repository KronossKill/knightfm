# Privacy Policy — Knight FM

> **Notice:** professional legal template adapted to Knight FM (Next.js + managed database + Web3/Solana), aligned with the **RGPD (UE) 2016/679** (GDPR), the **LOPDGDD 3/2018**, California's **CCPA/CPRA**, and equivalent principles (LGPD, PDPA). **It must be reviewed by an attorney** and the data controller's details completed before publication.

**Last updated:** [FECHA] · **Version:** 1.0

## 1. Data controller

- **Controller:** [RAZÓN SOCIAL O NOMBRE COMPLETO]
- **NIF/NIE/CIF:** [NÚMERO]
- **Address:** [DIRECCIÓN FÍSICA COMPLETA]
- **Privacy email:** [EMAIL PRIVACIDAD]
- **Data Protection Officer (if applicable):** [CONTACTO DPD]
- Processors: the hosting/database provider (e.g., **Supabase/PostgreSQL** or another equivalent contracted provider), the transactional email provider, and the captcha provider, under data processing agreements (art. 28 RGPD).

## 2. What data we process

| Category | Specific data | When |
|---|---|---|
| **Account** | email address, username, password (Argon2 hash), chosen language and theme, sign-up date | registration and use |
| **Verification** | email verification code (stored as a hash), password recovery tokens | registration, support |
| **Web3 identity** | linked public Solana address (optional), signatures/identifiers of deposit or withdrawal transactions | if you connect a wallet |
| **Game economy** | internal $Knight balances, ledger entries, transfers, auctions, box office | game use |
| **Security and anti-fraud** | registration and last-login IP address, VPN/proxy assessment results, audit events (login attempts, blocks), IP-based links between accounts | always (legitimate interest) |
| **Communications** | messages between Users within the game, platform notifications | game use |
| **First-party analytics** | anonymous interface usage events (sections viewed, clicks), pseudonymized; emails and identifying data are removed before storage | **only if you opt in to analytics** |
| **Support** | content of your communications with support | if you contact us |

**We do not process** specially protected data, we do not carry out profiling for advertising purposes, and we do not sell personal data to third parties.

## 3. Purposes and legal bases (RGPD)

| Purpose | Legal basis |
|---|---|
| Create and manage the Account, provide the game (contract) | **performance of a contract** (art. 6.1.b) |
| Verify the email address, prevent fake accounts | contract performance / **legitimate interest** |
| Security, anti-multi-account control, fraud and abuse prevention (IP, VPN, audit) | **legitimate interest** (art. 6.1.f) and the legal duty of security |
| $Knight payment features via Solana | contract performance; compliance with accounting obligations (**legal obligation**) |
| First-party interface analytics | **consent** (art. 6.1.a) — revocable at any time |
| Operational service communications (not marketing) | contract performance / legitimate interest |
| Handling rights and claims | legal obligation / legitimate interest |

**CCPA/CPRA (California):** we process data for the business purposes described above; we do **not sell** or share personal information "for consideration" (sale/share) as defined in the CPRA, and we do not discriminate for exercising your rights.

## 4. Wallet addresses and on-chain data

4.1. The public Solana address you link is a **pseudonymous** identifier: it does not contain your name, but it is considered **personal data** under the RGPD when it can be associated with you (and we treat it as such).

4.2. Warnings you should be aware of:

- The blockchain is **public and immutable**: any data written in an on-chain transaction falls outside the controller's control and **cannot be erased** (material limitation of art. 17 RGPD, recognized by the EDPB).
- The controller will never ask for your private key or your seed phrase. You must never share them.

4.3. Deposits and withdrawals are verified by comparing the addresses of the transactions with the platform system's wallet; verification records are treated as security and accounting data.

## 5. Retention

- **Active account:** for as long as the account exists.
- **Inactive account:** after 40 days without access the account is marked INACTIVE and may be purged under the game rules; definitive deletion occurs upon account deletion.
- **Security and audit records:** up to 12 months (or the applicable statutory period), for defense against abuse.
- **Ledger entries ($Knight ledger):** 10 years, or the applicable tax limitation period, with pseudonymization where possible.
- **Analytics:** up to 24 months.
- When several periods coincide, the longest one applies by legal obligation.

## 6. Recipients and transfers

6.1. **We do not sell your data.** It is only disclosed to:

- Infrastructure providers necessary for the service (hosting, managed database, transactional email, captcha), under data processing agreements and appropriate contractual clauses.
- Public authorities where there is a legal obligation or a valid request.
- Third parties in the event of a merger or corporate reorganization, with notice and in accordance with the law.

6.2. If international transfers outside the EEA occur (e.g., to hosting providers in the US), they rely on adequacy decisions, the **EU-US Data Privacy Framework** where applicable, or **Standard Contractual Clauses** with supplementary measures.

## 7. Your rights

You may exercise them free of charge by contacting [EMAIL PRIVACIDAD] (sufficiently identifying yourself):

- **Access:** know what data of yours we process and receive a copy.
- **Rectification:** correct inaccurate data.
- **Erasure ("right to be forgotten"):** delete your account and your personal data (see 7.1).
- **Portability:** receive your data in a structured format (JSON/CSV).
- **Objection and restriction:** object to processing based on legitimate interest or request restriction while a claim is being verified.
- **Withdrawal of consent** (e.g., analytics) at any time, without affecting the lawfulness of prior processing.
- **Complaint** before the Agencia Española de Protección de Datos (`www.aepd.es`) or your local authority. California: know/delete/correct requests via [EMAIL PRIVACIDAD]; we will verify your identity; response ≤ 45 days.

### 7.1. Right to be forgotten: how it works in Knight FM

- Upon confirming account deletion, the following are deleted or anonymized: email, username, registration IP, sessions, messages, internal balances, and wallet links.
- **What cannot be erased:** (a) what the law requires to be retained (transaction accounting, pseudonymized); (b) **data already written on-chain** (irreversible by blockchain design); (c) partially aggregated security records that no longer identify you.
- You can unlink the wallet address before deletion to minimize persistent links.

## 8. Minors

The service is intended for persons aged 18 or over and **we do not knowingly process data of minors**. If we detect a minor's account, it will be suspended and its data deleted. If you believe a minor has provided us with data, contact [EMAIL PRIVACIDAD].

## 9. Security

Appropriate technical and organizational measures: passwords hashed with **Argon2**, session tokens with rotation and revocation, CSRF/XSS protection, rate limiting, security event logging, encryption in transit (TLS), role-based access control (ADMIN/USER), least privilege, and audit logging of administrative actions. Security is proportionate to the risk and reviewed periodically.

## 10. Cookies and local storage

See the **Cookie Policy**, which details technical storage and optional analytics, and the platform's consent banner where you can accept or reject.

## 11. Automated decisions

The system applies automated **security** decisions (blocking due to multi-account detected by IP, blocking due to VPN under a strict policy) on the basis of legitimate interest. They have human oversight (an administrator can review and unblock), and you may request human review by writing to [EMAIL PRIVACIDAD]. **No** automated decisions with legal effects on persons exist outside the platform's security context.

## 12. Changes to this policy

We will publish the current version here with its date. Substantial changes will be announced within the Platform with reasonable notice.

## 13. Contact

Privacy: [EMAIL PRIVACIDAD] · Postal address: [DIRECCIÓN FÍSICA COMPLETA].
