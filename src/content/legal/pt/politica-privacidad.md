# Política de Privacidade — Knight FM

> **Aviso:** modelo legal profissional adaptado ao Knight FM (Next.js + base de dados gerenciada + Web3/Solana), alinhado ao **RGPD/GDPR (UE) 2016/679**, à **LOPDGDD 3/2018**, à **CCPA/CPRA** da Califórnia e a princípios equivalentes (LGPD, PDPA). **Deve ser revisado por um advogado** e os dados do responsável devem ser preenchidos antes da publicação.

**Última atualização:** [FECHA] · **Versão:** 1.0

## 1. Responsável pelo tratamento

- **Responsável:** [RAZÓN SOCIAL O NOMBRE COMPLETO]
- **NIF/NIE/CIF:** [NÚMERO]
- **Domicílio:** [DIRECCIÓN FÍSICA COMPLETA]
- **E-mail de privacidade:** [EMAIL PRIVACIDAD]
- **Encarregado de Proteção de Dados (se aplicável):** [CONTACTO DPD]
- Operadores de tratamento: provedor de hosting/base de dados (p. ex. **Supabase/PostgreSQL** ou outro equivalente contratado), provedor de e-mail transacional e provedor de captcha, conforme contratos de tratamento de dados (art. 28 do RGPD/GDPR).

## 2. Quais dados tratamos

| Categoria | Dados concretos | Quando |
|---|---|---|
| **Conta** | endereço de e-mail, nome de usuário, senha (hash Argon2), idioma e tema escolhidos, data de registro | registro e uso |
| **Verificação** | código de verificação de e-mail (armazenado como hash), tokens de recuperação de senha | registro, suporte |
| **Identidade Web3** | endereço público da Solana vinculado (opcional), assinaturas/identificadores de transações de depósito ou saque | se você conecta uma wallet |
| **Economia do jogo** | saldos internos de $Knight, movimentos contábeis, transferências, leilões, bilheteria | uso do jogo |
| **Segurança e antifraude** | endereço IP de registro e último acesso, resultados de avaliação VPN/proxy, eventos de auditoria (tentativas de login, bloqueios), vínculos entre contas por IP | sempre (interesse legítimo) |
| **Comunicações** | mensagens entre Usuários dentro do jogo, notificações da plataforma | uso do jogo |
| **Analytics próprio** | eventos anônimos de uso da interface (seções vistas, cliques), com pseudonimização; os e-mails e dados identificativos são eliminados antes do armazenamento | **somente se você aceitar o analytics** |
| **Suporte** | conteúdo das suas comunicações com o suporte | se você contatar |

**Não tratamos** dados especialmente protegidos, nem realizamos elaborações de perfil com fins publicitários, nem vendemos dados pessoais a terceiros.

## 3. Finalidades e bases jurídicas (RGPD/GDPR)

| Finalidade | Base jurídica |
|---|---|
| Criar e gerenciar a Conta, prestar o jogo (contrato) | **execução de contrato** (art. 6.1.b) |
| Verificar o endereço de e-mail, evitar contas falsas | execução de contrato / **interesse legítimo** |
| Segurança, controle antimulticonta, prevenção de fraude e abuso (IP, VPN, auditoria) | **interesse legítimo** (art. 6.1.f) e dever legal de segurança |
| Funcionalidades de pagamento com $Knight via Solana | execução de contrato; cumprimento de obrigações contábeis (**obrigação legal**) |
| Analytics próprio da interface | **consentimento** (art. 6.1.a) — revogável a qualquer momento |
| Comunicações operacionais do serviço (não marketing) | execução de contrato / interesse legítimo |
| Atender direitos e reclamações | obrigação legal / interesse legítimo |

**CCPA/CPRA (Califórnia):** tratamos os dados com as finalidades comerciais descritas acima; **não vendemos** nem compartilhamos informações pessoais "por contraprestação" (sale/share) conforme definido na CPRA, e não discriminamos pelo exercício dos seus direitos.

## 4. Endereços de wallet e dados on-chain

4.1. O endereço público da Solana que você vincular é um identificador **pseudônimo**: não contém o seu nome, mas é considerado **dado pessoal** sob o RGPD/GDPR quando pode ser associado a você (e assim o tratamos).

4.2. Advertências que você deve conhecer:

- A blockchain é **pública e imutável**: qualquer dado escrito em uma transação on-chain fica fora do controle do responsável e **não pode ser apagado** (limitação material do art. 17 do RGPD/GDPR, reconhecida pelo EDPB).
- O responsável nunca solicitará a sua chave privada nem a sua frase-semente. Você nunca deve compartilhá-las.

4.3. Os depósitos e saques são verificados comparando os endereços das transações com a wallet do sistema da plataforma; os registros de verificação são tratados como dados de segurança e contabilidade.

## 5. Conservação

- **Conta ativa:** enquanto a conta existir.
- **Conta inativa:** após 40 dias sem acesso, a conta é marcada como INATIVA e pode ser purgada conforme as regras do jogo; a eliminação definitiva ocorre com a exclusão da conta.
- **Registros de segurança e auditoria:** até 12 meses (ou o prazo legal aplicável), para defesa contra abusos.
- **Movimentos contábeis (livro-razão do $Knight):** 10 anos, ou o prazo de prescrição fiscal aplicável, com pseudonimização quando possível.
- **Analytics:** até 24 meses.
- Quando vários prazos coincidem, aplica-se o mais longo por obrigação legal.

## 6. Destinatários e transferências

6.1. **Não vendemos os seus dados.** São comunicados apenas a:

- Provedores de infraestrutura necessários para o serviço (hospedagem, base de dados gerenciada, e-mail transacional, captcha), sob contrato de tratamento de dados e cláusulas apropriadas.
- Autoridades públicas quando exista obrigação legal ou requerimento válido.
- Terceiros em caso de fusão ou reorganização societária, com aviso e conforme a lei.

6.2. Se ocorrerem transferências internacionais fora do EEE (p. ex. para provedores de hospedagem nos EUA), elas se amparam em decisões de adequação, no **EU-US Data Privacy Framework** quando aplicável, ou em **Cláusulas Contratuais Padrão** com medidas complementares.

## 7. Os seus direitos

Você pode exercê-los gratuitamente, dirigindo-se a [EMAIL PRIVACIDAD] (identificando-se suficientemente):

- **Acesso:** saber quais dados seus tratamos e receber uma cópia.
- **Retificação:** corrigir dados inexatos.
- **Supressão ("direito ao esquecimento"):** apagar a sua conta e os seus dados pessoais (ver 7.1).
- **Portabilidade:** receber os seus dados em formato estruturado (JSON/CSV).
- **Oposição e limitação:** opor-se a tratamentos baseados em interesse legítimo ou pedir a limitação enquanto se verifica uma reclamação.
- **Retirada do consentimento** (p. ex. analytics) a qualquer momento, sem afetar a licitude anterior.
- **Reclamação** perante a Agência Espanhola de Proteção de Dados (`www.aepd.es`) ou a sua autoridade local. Califórnia: solicitações de conhecer/apagar/corrigir via [EMAIL PRIVACIDAD]; verificaremos a sua identidade; resposta ≤ 45 dias.

### 7.1. Direito ao esquecimento: como funciona no Knight FM

- Ao confirmar a exclusão da conta, eliminam-se ou anonimizam-se: e-mail, nome de usuário, IP de registro, sessões, mensagens, saldos internos e vínculos com a wallet.
- **Não é possível apagar:** (a) o que a lei obrigue a conservar (contabilidade de movimentos, pseudonimizada); (b) os **dados já escritos on-chain** (irreversíveis pelo design da blockchain); (c) registros de segurança parcialmente agregados que já não identificam você.
- Você pode desvincular o endereço da wallet antes da exclusão para minimizar os vínculos persistentes.

## 8. Menores de idade

O serviço destina-se a maiores de 18 anos e **não tratamos conscientemente dados de menores**. Se detectarmos uma conta de um menor, ela será suspensa e os seus dados eliminados. Se você acha que um menor nos forneceu dados, entre em contato com [EMAIL PRIVACIDAD].

## 9. Segurança

Medidas técnicas e organizacionais apropriadas: senhas criptografadas com **Argon2**, tokens de sessão com rotação e revogação, proteção CSRF/XSS, limitação de requisições, captura de eventos de segurança, criptografia em trânsito (TLS) e controle de acesso por papéis (ADMIN/USER), princípio do menor privilégio e registro de auditoria das ações administrativas. A segurança é proporcional ao risco e é revisada periodicamente.

## 10. Cookies e armazenamento local

Consulte a **Política de Cookies**, que detalha o armazenamento técnico e o analytics opcional, e o banner de consentimento da plataforma onde você pode aceitar ou recusar.

## 11. Decisões automatizadas

O sistema aplica decisões automatizadas de **segurança** (bloqueio por multiconta detectada por IP, bloqueio por VPN sob política estrita) por interesse legítimo. Elas têm supervisão humana (um administrador pode revisar e desbloquear) e você pode solicitar revisão humana escrevendo para [EMAIL PRIVACIDAD]. **Não** existem decisões automatizadas com efeitos legais sobre pessoas fora do contexto de segurança da plataforma.

## 12. Mudanças nesta política

Publicaremos aqui a versão vigente com a sua data. As alterações substanciais serão anunciadas dentro da Plataforma com antecedência razoável.

## 13. Contato

Privacidade: [EMAIL PRIVACIDAD] · Endereço postal: [DIRECCIÓN FÍSICA COMPLETA].
