You are a senior full-stack engineer and product-minded system designer.

Build a production-ready secure investment client portal and admin backoffice using:

Next.js App Router
TypeScript
Tailwind CSS
Local Node.js/Express backend
Local database
Local file storage

Do not use Firebase, Firestore, Firebase Authentication, Firebase Storage, Cloud Functions, Supabase, Prisma, or any external backend service.

The entire application must be locally hostable and runnable on a VPS or local machine.

Use:

Next.js for frontend
Node.js/Express for backend API
JWT authentication
bcrypt password hashing
SQLite or SQL.js for local persistence
local filesystem storage for PDF statements
Recharts or Chart.js for charts
Lucide React for icons

The application is an internal financial portal for a company that offers multiple investment products to clients.

The system has two separate experiences:

Client Portal
Admin Portal

Clients must be able to:

securely log in
view their own portfolio and holdings
see portfolio value and P/L
download statements
submit investment-related requests

Administrators must be able to:

securely log in
access a separate admin portal
manage clients
manage products
manage requests
manage pricing
manage portfolio positions
upload and manage statements

Clients are read-only users.

They can:

view their information
download statements
submit requests

They cannot:

execute trades directly
modify portfolio holdings directly
access other clients’ data
access admin routes

All trading or investment actions are request-based:

buy
sell
subscribe
withdraw

Some products support manual pricing, especially:

private funds
sukuk
non-market instruments

Admins must be able to update manual prices.

Strict role-based access is mandatory.

Client users must only access client features and only their own data.
Admin users must have privileged access to admin features.
Security and data isolation are critical.

No client may ever access another client’s data.
Admin-only actions must be protected at both UI and API levels.

Implement secure login using local authentication:

email
password
bcrypt hashed passwords
JWT access token
role-based user metadata

Support roles:

client
admin

After login:

if role = client, redirect to client portal
if role = admin, redirect to admin portal

Protect routes so:

unauthenticated users cannot access protected pages
clients cannot access admin routes
admins do not rely on client-only assumptions unless intentionally allowed

Use route sections like:

/client/dashboard
/client/portfolio
/client/statements
/client/requests

/admin/dashboard
/admin/clients
/admin/products
/admin/portfolios
/admin/pricing
/admin/requests
/admin/statements

Also include:

/login
role-aware redirect after authentication

Design the local database schema cleanly.

Users table:

id
name
email
passwordHash
role client | admin
status active | suspended
createdAt
updatedAt
optional profile fields

Products table:

id
name
type stock | crypto | fund | sukuk | private
pricingMode api | manual
currency
isActive
createdAt
updatedAt

Portfolio positions table:

id
userId
productId
quantity
avgPrice
createdAt
updatedAt

Prices table:

id
productId
price
source manual | api
updatedAt

Investment requests table:

id
userId
type buy | sell | subscribe | withdraw
productId optional
amount optional
message
status pending | approved | rejected | executed
createdAt
updatedAt
rejectionReason optional

Statements table:

id
userId
period
fileName
filePath
createdAt

Optional additional tables:

audit_logs
product_price_history

Implement secure backend middleware:

authenticate JWT
require admin role
require client ownership
validate request payloads
block suspended users
centralized error handling

Secure statement files so:

clients can only download their own statements
admins can upload and manage statements
other users cannot access files by guessing URLs
PDF downloads must go through authenticated API routes, not public static links

Required backend behavior:

When a request is created:

force status = pending
set timestamps server-side
validate payload
bind request to authenticated user
do not trust client-supplied userId

Admin-only API actions:

create client users
assign roles
activate/suspend clients
create/edit products
update manual prices
assign/update/remove portfolio positions
upload statement PDFs
approve/reject/execute requests

Maintain audit logs for important admin changes:

client updates
portfolio changes
price updates
request status changes
statement uploads

Build a polished client dashboard showing:

total portfolio value
unrealized P/L
asset allocation
holdings summary by asset class

Include visualizations:

allocation pie chart
holdings/value breakdown

Display detailed holdings:

product name
product type
quantity
average price
current price
current value
unrealized P/L

Support grouping or filtering by asset class if useful.

Display statements with:

period
created date
secure PDF download action

Provide request submission form with:

request type
product optional
amount optional
message

Show historical requests with statuses:

pending
approved
rejected
executed

Clients must not be able to directly buy or sell.

Build admin dashboard showing:

total clients
total AUM
number of pending requests
recent activity
summary cards

Admins can:

view all requests
filter by status
filter by client
approve requests
reject requests
mark requests as executed

Admins can:

create client records
edit client data
activate/suspend clients
manage login-linked user records safely

Admins can:

create products
edit products
define product type
define pricing mode
activate/deactivate products

Admins can:

assign products to clients
create/update/remove portfolio positions
edit quantity
edit average price

Admins can:

update manual prices
store price timestamps
track price history

Admins can:

upload PDF statements to local storage
attach statements to a client
manage statement metadata

Implement clean reusable calculation logic:

For each position:

positionValue = quantity * latestPrice
unrealizedPnL = (latestPrice - avgPrice) * quantity

At portfolio level:

total portfolio value
total unrealized P/L
allocation percentages by product type or asset class

Keep calculation logic clear, typed, and reusable.

Design a clean, secure, responsive, card-based financial dashboard.

Use:

responsive layout
clear main navigation
card-based sections
strong spacing and hierarchy
mobile-friendly behavior
desktop-first polish with mobile support

Client navigation:

Dashboard
Portfolio
Statements
Requests

Admin navigation:

Dashboard
Clients
Products
Portfolios
Pricing
Requests
Statements

Use:

Inter
strong readability for financial values and tables
modern, objective, professional style
clean minimalist line icons
subtle hover states
smooth transitions
loading feedback
card and button transitions

Do not over-animate.

Use Tailwind CSS with restrained financial styling:

white / slate / gray base
professional blue primary accent
green/red only for financial gain/loss states
rounded cards
soft shadows
modern but conservative UI

Engineering requirements:

strong TypeScript typing
separate concerns clearly
reusable components
reusable API client layer
reusable backend services
reusable calculations/helpers
clean folder structure
loading, error, and empty states
no hardcoded mock data in final output
deployment-ready local configuration

Suggested structure:

app/
components/
contexts/
lib/api/
lib/auth/
lib/calculations/
lib/types/
lib/utils/
server/
server/routes/
server/middleware/
server/services/
server/db/
server/uploads/statements/

Produce a complete implementation including:

Next.js frontend
Express backend
JWT auth flow
protected role-based routing
local database schema and initialization
local file upload/download handling
admin portal
client portal
clean responsive UI
setup instructions
deployment-ready configuration

Do not build direct trading execution.
Do not add chat trading.
Do not add broker integration.
Do not use Firebase.
Do not use fake external backend services.
Do not leave security incomplete.
Do not treat this as a simple demo.

This should feel like a real internal financial client reporting and request portal, suitable for a company managing client investment products with both market-priced and manually-priced instruments.

Start by designing the structure, data flow, auth flow, API routes, and database schema first, then implement the application step by step.