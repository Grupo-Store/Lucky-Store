# Implementação: Email 2FA (Autenticação em Dois Fatores via Email)

**Data:** 6 de maio de 2026  
**Contexto:** Substituição do fluxo TOTP (Google Authenticator) por código de 6 dígitos enviado via email a cada login.

---

## Por que foi feito

O fluxo anterior de 2FA usava **TOTP** (Time-based One-Time Password): o usuário precisava configurar um aplicativo autenticador (Google Authenticator, Authy) escaneando um QR code antes de conseguir ativar o 2FA. Esse setup era:

- **Opcional** — só entrava no fluxo de 2FA se o usuário tivesse feito o setup previamente.
- **Fora do contexto do produto** — exigia instalação de app externo numa plataforma de uso interno de equipe pequena.

O novo fluxo envia um **código de 6 dígitos diretamente para o email** do usuário a cada login, sem configuração prévia, tornando o 2FA **obrigatório e transparente** para todos os usuários.

---

## Fluxo completo após a mudança

```
1. POST /auth/login  { email, password }
       ↓
   Autentica credenciais (igual ao anterior)
       ↓
   Gera código de 6 dígitos (ex: "847291")
   Salva na tabela email_verification_codes com TTL de 5 min
   Envia email em background (não bloqueia a resposta)
       ↓
   Retorna HTTP 202: { "requires_2fa": true, "user_id": "..." }

2. Usuário recebe o email, lê o código, digita na segunda tela

3. POST /auth/verify-2fa  { email, code }
       ↓
   Busca código válido (não usado, não expirado) para o email
       ↓
   Marca código como usado
       ↓
   Retorna HTTP 200: { access_token, refresh_token, token_type, user }
```

---

## Arquivos criados

### `backend/app/models/email_verification.py`

Modelo SQLAlchemy para a tabela `email_verification_codes`.

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK para `users.id` (CASCADE delete) |
| `code` | String(6) | Código numérico de 6 dígitos |
| `expires_at` | DateTime (tz) | Momento de expiração (UTC) |
| `used` | Boolean | Se já foi consumido |
| `created_at` | DateTime (tz) | Criação automática |

**Por que `CASCADE DELETE`:** se um usuário for deletado do banco, os códigos órfãos são removidos automaticamente.

---

### `backend/alembic/versions/b3f8c2d1a9e7_add_email_verification_codes.py`

Migration que cria a tabela `email_verification_codes` e o índice em `user_id`.

- **Revision:** `b3f8c2d1a9e7`
- **Revises:** `dc8a321ea931` (baseline)
- **Aplicada com:** `alembic upgrade head`

---

### `backend/app/services/email.py`

Serviço de envio de email usando `fastapi-mail`.

**`send_verification_email(email, name, code)`**
- Função `async` — é chamada via `BackgroundTasks` do FastAPI, sem bloquear a resposta do login.
- Usa `ConnectionConfig` com as configurações do `.env` (SMTP Gmail).
- Envia HTML formatado com o código centralizado em destaque visual.

**Por que `BackgroundTasks` em vez de `await`:**  
O usuário recebe o `202` imediatamente. O email é disparado em segundo plano logo depois. Isso evita que uma lentidão do SMTP (ex: 1–3s) atrase a resposta da API.

---

## Arquivos modificados

### `backend/requirements.txt`

Adicionados:
```
fastapi-mail==1.4.1
aiosmtplib==2.0.2
```

`fastapi-mail` é o wrapper async para envio de email no FastAPI. `aiosmtplib` é a dependência de transporte SMTP que ele usa internamente. A versão `3.0.1` de `aiosmtplib` é incompatível com `fastapi-mail==1.4.1`; a versão correta é `2.0.2`.

---

### `backend/app/config.py`

Adicionadas as configurações de email:

```python
MAIL_USERNAME: str = ""
MAIL_PASSWORD: str = ""
MAIL_FROM: str = ""
MAIL_SERVER: str = "smtp.gmail.com"
MAIL_PORT: int = 587
EMAIL_CODE_EXPIRE_MINUTES: int = 5
```

Lidas automaticamente do `.env` via `pydantic-settings`.

---

### `backend/.env` e `backend/.env.example`

Adicionada a seção:

```dotenv
# Email 2FA — Gmail: crie uma App Password em myaccount.google.com/apppasswords
MAIL_USERNAME=seu_email@gmail.com
MAIL_PASSWORD=sua_app_password
MAIL_FROM=seu_email@gmail.com
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
EMAIL_CODE_EXPIRE_MINUTES=5
```

**Como obter App Password no Gmail:**
1. Acesse [myaccount.google.com/security](https://myaccount.google.com/security)
2. Ative a verificação em duas etapas (obrigatório)
3. Vá em **Senhas de app**
4. Crie uma senha para "Outro (nome personalizado)" → ex: "Orderly Hub"
5. Cole a senha gerada (16 caracteres) em `MAIL_PASSWORD`

---

### `backend/app/services/auth.py`

**Novos métodos:**

**`create_email_verification_code(db, user_id) → str`**
```
1. Invalida todos os códigos não usados do usuário (UPDATE used=True)
   → Garante que só o código mais recente seja válido (ex: clique duplo no "login")
2. Gera 6 dígitos aleatórios com random.choices(string.digits, k=6)
3. Calcula expires_at = agora + EMAIL_CODE_EXPIRE_MINUTES
4. Persiste o registro e retorna o código em string
```

**`verify_email_code(db, email, code) → User`**
```
1. Busca o usuário pelo email
2. Consulta a tabela: user_id = user.id AND code = code AND used = False AND expires_at > now()
3. Se não encontrar: AuthenticationException("Invalid or expired code") → HTTP 401
4. Marca o código como used=True e commita
5. Retorna o User para emissão de tokens
```

**Métodos TOTP mantidos (setup_totp, verify_totp_setup):**  
Mantidos para não quebrar usuários que já tinham TOTP ativado no banco. Não são mais expostos nas rotas, mas o código existe caso necessário no futuro.

---

### `backend/app/schemas/user.py`

**Adicionado:**

```python
class EmailCodeVerifyRequest(BaseModel):
    email: EmailStr
    code: str
```

Usado pelo endpoint `POST /auth/verify-2fa` no lugar de `TOTPVerifyRequest`.

`TOTPVerifyRequest` e `TOTPSetupResponse` foram mantidos no arquivo por compatibilidade, mas não são mais usados nas rotas ativas.

---

### `backend/app/api/routes/auth.py`

**`POST /auth/login` — alterado**

- Era `def login` (síncrono) → agora `async def login` (necessário para usar `BackgroundTasks` com função async)
- Adicionado parâmetro `background_tasks: BackgroundTasks`
- Removida a lógica condicional de TOTP (`if user.totp_enabled`)
- Agora **sempre** gera e envia o código por email, retornando `202` para todos os usuários

**`POST /auth/verify-2fa` — alterado**

| Antes | Depois |
|---|---|
| Body: `{ email, token }` (código TOTP) | Body: `{ email, code }` (código de email) |
| Validava via `verify_totp(user.totp_secret, token)` | Valida via `AuthService.verify_email_code(db, email, code)` |
| Retornava `TOTPVerifyResponse` | Retorna `LoginResponse` (mesmo schema) |

**`POST /auth/2fa/setup` e `POST /auth/2fa/confirm` — removidos**  
Esses endpoints existiam para configurar o Google Authenticator. Com email 2FA, não há setup necessário — todos os usuários recebem o código automaticamente.

**`POST /auth/change-password` — consolidado**  
Havia uma duplicata acidental no arquivo anterior (dois `@router.post("/change-password")`). A versão duplicada foi removida.

---

### `backend/app/models/__init__.py`

Adicionada a importação do novo modelo:
```python
from app.models.email_verification import EmailVerificationCode
```
e `"EmailVerificationCode"` no `__all__`.

---

## Segurança

| Aspecto | Decisão |
|---|---|
| Tamanho do código | 6 dígitos — padrão do mercado (10⁶ combinações) |
| TTL | 5 minutos — configurável via `EMAIL_CODE_EXPIRE_MINUTES` |
| Invalidação | Ao usar o código, `used=True` imediatamente → não pode ser reaproveitado |
| Códigos anteriores | Invalidados ao gerar um novo → sem risco de múltiplos códigos válidos em paralelo |
| Resposta de erro | "Invalid or expired code" — não revela se o email existe (proteção contra enumeração) |
| Transporte | SMTP com STARTTLS (porta 587) — criptografia em trânsito |

---

## Testes

Todos os **196 testes existentes** continuam passando após a mudança. Os testes das rotas de auth mockam `AuthService` diretamente, portanto não dependem do fluxo TOTP ou email.

Testes específicos para o novo fluxo de email 2FA **não foram criados neste commit** — podem ser adicionados na próxima fase de testes de integração.

---

## O que ainda precisa ser feito

- [ ] Preencher `MAIL_USERNAME`, `MAIL_PASSWORD` e `MAIL_FROM` no `.env` de produção (Railway)
- [ ] Rodar `alembic upgrade head` no banco de produção
- [ ] Testes unitários para `AuthService.create_email_verification_code` e `verify_email_code`
- [ ] Teste de integração do fluxo completo login → email → verify
