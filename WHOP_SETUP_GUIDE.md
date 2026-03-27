# Misión Técnica: Integración de Pagos Premium para "Misil"

## CONTEXTO DEL PROYECTO
"Misil" es una extensión profesional para Google Chrome (v4.5.4) que permite descargar fotos y videos de Telegram Web con un solo clic. Actualmente, la extensión ofrece **100 descargas gratuitas al mes** a sus usuarios registrados, gestionando las cuotas y la autenticación mediante **Supabase**.

**El Reto:**
Necesitamos implementar un plan **PRO** (descargas ilimitadas) que el usuario pueda adquirir mediante la plataforma de pagos **Whop**. La meta es que el usuario nunca tenga que introducir manualmente un código de licencia; el sistema debe detectar el pago mediante un Webhook y actualizar su cuenta automáticamente.

---

### **OBJETIVO DE TU TAREA (PARA LA IA NAVEGADORA)**
Tu misión es configurar el puente técnico entre **Whop** (Pasarela) y **Supabase** (Base de Datos) para que al completarse un pago, la base de datos se actualice de forma invisible utilizando el ID único del usuario como conector.

---


### **1. Configuración en el Dashboard de [Whop.com](https://whop.com)**
1.  **Producto**: Crear un nuevo producto digital llamado **"Misil Premium"**.
2.  **Plan**: Configurar un plan de suscripción o pago único (ejemplo: $5 USD).
3.  **Identificadores**: Extraer el **Product ID**.
4.  **Desarrolladores**: Ir a la sección de API y obtener la **Server-side API Key**.
5.  **Checkout**: Configurar el enlace de pago para que acepte un campo de **metadata personalizado** llamado `supabase_user_id`. Este ID debe devolverse en el cuerpo del Webhook.
6.  **Webhook**: (Este paso se completa después del paso 2). Añadir un Webhook que escuche el evento `payment.succeeded` apuntando a la URL que obtendrás de Supabase.

---

### **2. Configuración en el Dashboard de [Supabase.com](https://supabase.com)**
1.  **Tabla de Datos**: Asegurarse de que la tabla `profiles` tenga una columna llamada `plan` (tipo: `text`, valor por defecto: `'free'`).
2.  **Edge Function**: Crear una función (ejemplo: `whop-handler`) que:
    *   Reciba el JSON del Webhook de Whop.
    *   Extraiga el valor `supabase_user_id` de los metadatos.
    *   Actualice la tabla `profiles`: `UPDATE profiles SET plan = 'pro' WHERE id = supabase_user_id`.
3.  **URL de Función**: Obtener y copiar la URL pública de esta función (ej: `https://[id].supabase.co/functions/v1/whop-handler`).

---

### **3. DATOS DE SALIDA (A entregar al usuario)**
Una vez completada la navegación y configuración, por favor devuelve estos 4 parámetros exactos para terminar la programación:

1.  **Product ID**: `[ID de Whop]`
2.  **Whop API Key**: `[Key de Servidor]`
3.  **Webhook Endpoint**: `[URL de Supabase]`
4.  **Checkout Base URL**: `[URL para invocar el pago]`

---

> [!IMPORTANT]
> **Nota técnica**: Es fundamental que el ID de usuario de Supabase viaje oculto en la URL de pago de Whop para que el Webhook sepa a quién activar el plan sin necesidad de intervención manual del usuario.
