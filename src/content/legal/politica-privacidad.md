# Política de Privacidad — Knight FM

> **Aviso:** plantilla legal profesional adaptada a Knight FM (Next.js + base de datos gestionada + Web3/Solana), alineada con el **RGPD (UE) 2016/679**, la **LOPDGDD 3/2018**, la **CCPA/CPRA** de California y principios equivalentes (LGPD, PDPA). **Debe ser revisada por un abogado** y completarse los datos del responsable antes de publicarse.

**Última actualización:** [FECHA] · **Versión:** 1.0

## 1. Responsable del tratamiento

- **Responsable:** [RAZÓN SOCIAL O NOMBRE COMPLETO]
- **NIF/NIE/CIF:** [NÚMERO]
- **Domicilio:** [DIRECCIÓN FÍSICA COMPLETA]
- **Correo de privacidad:** [EMAIL PRIVACIDAD]
- **Delegado de Protección de Datos (si aplica):** [CONTACTO DPD]
- Encargados de tratamiento: proveedor de hosting/base de datos (p. ej. **Supabase/PostgreSQL** u otro equivalente contratado), proveedor de correo transaccional y proveedor de captcha, conforme a contratos de encargo (art. 28 RGPD).

## 2. Qué datos tratamos

| Categoría | Datos concretos | Cuándo |
|---|---|---|
| **Cuenta** | correo electrónico, nombre de usuario, contraseña (hash Argon2), idioma y tema elegidos, fecha de alta | registro y uso |
| **Verificación** | código de verificación de correo (almacenado como hash), tokens de recuperación de contraseña | registro, soporte |
| **Identidad Web3** | dirección pública de Solana vinculada (opcional), firmas/identificadores de transacciones de recarga o retiro | si conectas una wallet |
| **Economía del juego** | saldos internos de $Knight, movimientos contables, fichajes, subastas, taquilla | uso del juego |
| **Seguridad y antifraude** | dirección IP de registro y último acceso, resultados de evaluación VPN/proxy, eventos de auditoría (intentos de login, bloqueos), enlaces entre cuentas por IP | siempre (interés legítimo) |
| **Comunicaciones** | mensajes entre Usuarios dentro del juego, notificaciones de la plataforma | uso del juego |
| **Analítica propia** | eventos anónimos de uso de la interfaz (secciones vistas, clics), con seudonimización; los correos y datos identificativos se eliminan antes de almacenar | **solo si aceptas la analítica** |
| **Soporte** | contenido de tus comunicaciones con soporte | si contactas |

**No tratamos** datos especialmente protegidos, ni realizamos elaboraciones de perfilado con fines publicitarios, ni vendemos datos personales a terceros.

## 3. Finalidades y bases jurídicas (RGPD)

| Finalidad | Base jurídica |
|---|---|
| Crear y gestionar la Cuenta, prestar el juego (contrato) | **ejecución de contrato** (art. 6.1.b) |
| Verificar el correo electrónico, evitar cuentas falsas | ejecución de contrato / **interés legítimo** |
| Seguridad, control antomulticuenta, prevención de fraude y abuso (IP, VPN, auditoría) | **interés legítimo** (art. 6.1.f) y deber legal de seguridad |
| Funcionalidades de pago con $Knight vía Solana | ejecución de contrato; cumplimiento de obligaciones contables (**obligación legal**) |
| Analítica propia de la interfaz | **consentimiento** (art. 6.1.a) — revocable en cualquier momento |
| Comunicaciones operativas del servicio (no marketing) | ejecución de contrato / interés legítimo |
| Atender derechos y reclamaciones | obligación legal / interés legítimo |

**CCPA/CPRA (California):** tratamos los datos con las finalidades comerciales descritas arriba; **no vendemos** ni compartimos información personal "por contraprestación" (sale/share) tal como se definen en la CPRA, y no discriminamos por ejercer tus derechos.

## 4. Direcciones de wallet y datos on-chain

4.1. La dirección pública de Solana que vincules es un identificador **seudónimo**: no contiene tu nombre, pero se considera **dato personal** bajo el RGPD cuando puede asociarse a ti (y así la tratamos).

4.2. Advertencias que debes conocer:

- La blockchain es **pública e inmutable**: cualquier dato escrito en una transacción on-chain queda fuera del control del responsable y **no puede borrarse** (limitación material del art. 17 RGPD, reconocida por el EDPB).
- El responsable nunca solicitará tu clave privada ni tu frase semilla. Nunca debes compartirlas.

4.3. Las recargas y retiros se verifican comparando las direcciones de las transacciones con la wallet del sistema de la plataforma; los registros de verificación se tratan como datos de seguridad y contabilidad.

## 5. Conservación

- **Cuenta activa:** mientras la cuenta exista.
- **Cuenta inactiva:** tras 40 días sin acceso la cuenta se marca INACTIVA y puede purgarse según las reglas del juego; la eliminación definitiva se produce con el borrado de cuenta.
- **Registros de seguridad y auditoría:** hasta 12 meses (o el plazo legal aplicable), para defensa frente a abusos.
- **Movimientos contables (libro mayor de $Knight):** 10 años, o el plazo de prescripción fiscal aplicable, con seudonimización cuando sea posible.
- **Analítica:** hasta 24 meses.
- Cuando varios plazos coinciden, se aplica el más largo por obligación legal.

## 6. Destinatarios y transferencias

6.1. **No vendemos tus datos.** Solo se comunican a:

- Proveedores de infraestructura necesarios para el servicio (hosting, base de datos gestionada, correo transaccional, captcha), bajo contrato de encargo de tratamiento y cláusulas apropiadas.
- Autoridades públicas cuando exista obligación legal o requerimiento válido.
- Terceros en caso de fusión o reorganización corporativa, con aviso y conforme a la ley.

6.2. Si se producen transferencias internacionales fuera del EEE (p. ej. a proveedores de hosting en EE. UU.), se amparan en decisiones de adecuación, el **EU-US Data Privacy Framework** cuando resulte aplicable, o **Cláusulas Contractuales Tipo** con medidas complementarias.

## 7. Tus derechos

Puedes ejercer gratuitamente, dirigiéndote a [EMAIL PRIVACIDAD] (identificándote suficientemente):

- **Acceso:** saber qué datos tuyos tratamos y recibir una copia.
- **Rectificación:** corregir datos inexactos.
- **Supresión ("derecho al olvido"):** borrar tu cuenta y tus datos personales (ver 7.1).
- **Portabilidad:** recibir tus datos en formato estructurado (JSON/CSV).
- **Oposición y limitación:** oponerte a tratamientos basados en interés legítimo o pedir la limitación mientras se verifica una reclamación.
- **Retirada del consentimiento** (p. ej. analítica) en cualquier momento, sin afectar a la licitud anterior.
- **Reclamación** ante la Agencia Española de Protección de Datos (`www.aepd.es`) o tu autoridad local. California: solicitudes de conocer/borrar/corregir vía [EMAIL PRIVACIDAD]; verificaremos tu identidad; respuesta ≤ 45 días.

### 7.1. Derecho al olvido: cómo funciona en Knight FM

- Al confirmar el borrado de cuenta se eliminan o anonimizan: correo, nombre de usuario, IP de registro, sesiones, mensajes, saldos internos y vínculos con la wallet.
- **No se puede borrar:** (a) lo que la ley obligue a conservar (contabilidad de movimientos, seudonimizada); (b) los **datos ya escritos on-chain** (irreversibles por diseño de la blockchain); (c) registros de seguridad parcialmente agregados que ya no te identifican.
- Puedes desvincular la dirección de wallet antes del borrado para minimizar los vínculos persistentes.

## 8. Menores de edad

El servicio está dirigido a mayores de 18 años y **no tratamos conscientemente datos de menores**. Si detectamos una cuenta de un menor, será suspendida y sus datos eliminados. Si crees que un menor nos ha facilitado datos, contacta con [EMAIL PRIVACIDAD].

## 9. Seguridad

Medidas técnicas y organizativas apropiadas: contraseñas cifradas con **Argon2**, tokens de sesión con rotación y revocación, protección CSRF/XSS, limitación de peticiones, captura de eventos de seguridad, cifrado en tránsito (TLS) y control de acceso por roles (ADMIN/USER), mínima privilegiación y registro de auditoría de acciones administrativas. La seguridad es proporcional al riesgo y se revisa periódicamente.

## 10. Cookies y almacenamiento local

Consulta la **Política de Cookies**, que detalla el almacenamiento técnico y la analítica opcional, y el banner de consentimiento de la plataforma donde puedes aceptar o rechazar.

## 11. Decisiones automatizadas

El sistema aplica decisiones automatizadas de **seguridad** (bloqueo por multicuenta detectada por IP, bloqueo por VPN bajo política estricta) por interés legítimo. Tienen supervisión humana (un administrador puede revisar y desbloquear) y puedes solicitar revisión humana escribiendo a [EMAIL PRIVACIDAD]. **No** existen decisiones automatizadas con efectos legales sobre personas fuera del contexto de seguridad de la plataforma.

## 12. Cambios en esta política

Publicaremos aquí la versión vigente con su fecha. Los cambios sustanciales se anunciarán dentro de la Plataforma con antelación razonable.

## 13. Contacto

Privacidad: [EMAIL PRIVACIDAD] · Dirección postal: [DIRECCIÓN FÍSICA COMPLETA].
