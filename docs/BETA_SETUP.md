# Setup de Infraestructura Beta - Instrucciones

Este documento explica cómo aplicar las migraciones y configurar la infraestructura necesaria para comenzar el beta testing.

## 1. Aplicar Migraciones en Supabase

### Opción A: Desde el Dashboard de Supabase (Recomendado)

1. Ve a tu proyecto en [https://supabase.com](https://supabase.com)
2. Navega a **SQL Editor**
3. Crea una nueva query
4. Copia y pega el contenido de cada archivo de migración en orden:

#### Migración 1: Tabla de Feedback
```bash
# Archivo: supabase/migrations/20260106_create_feedback_table.sql
```
Ejecuta todo el contenido del archivo.

#### Migración 2: Campos Beta en Profiles
```bash
# Archivo: supabase/migrations/20260106_add_beta_tracking_to_profiles.sql
```
Ejecuta todo el contenido del archivo.

### Opción B: Usando Supabase CLI

Si tienes Supabase CLI instalado:

```bash
# 1. Login a Supabase
supabase login

# 2. Link a tu proyecto
supabase link --project-ref <tu-project-ref>

# 3. Push las migraciones
supabase db push
```

## 2. Verificar que las Migraciones se Aplicaron

### Verificar Tabla `feedback`
```sql
-- Ejecuta en SQL Editor
SELECT * FROM feedback LIMIT 1;
```
Debería mostrar la estructura de la tabla (vacía está bien).

### Verificar Campos en `profiles`
```sql
-- Ejecuta en SQL Editor
SELECT 
  onboarding_completed,
  last_active_at,
  beta_feedback_count,
  beta_joined_at
FROM profiles
LIMIT 1;
```
Debería mostrar las columnas (con valores null está bien).

### Verificar RLS Policies
```sql
-- Ejecuta en SQL Editor
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename = 'feedback';
```
Deberías ver 3 policies:
- `Users submit feedback`
- `Users view own feedback`
- `Admins manage feedback`

## 3. Configurar Acceso Admin (Opcional)

Si quieres acceder al dashboard de feedback, necesitas un usuario admin:

```sql
-- Reemplaza 'tu-email@ejemplo.com' con tu email real
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'tu-email@ejemplo.com';
```

## 4. Verificar que la App Funciona

1. Reinicia el servidor de desarrollo si está corriendo:
   ```bash
   # Detén npm start (Ctrl+C) y vuelve a iniciar
   npm start
   ```

2. Abre la app en tu dispositivo/emulador

3. Intenta:
   - ✅ Ver el badge "Beta" en el header
   - ✅ Tocar el botón de feedback (ícono de chat)
   - ✅ Enviar un feedback de prueba
   - ✅ Verificar que aparece en Supabase:
     ```sql
     SELECT * FROM feedback ORDER BY created_at DESC LIMIT 5;
     ```

## 5. Troubleshooting

### Error: "relation 'feedback' does not exist"
- Las migraciones no se aplicaron correctamente
- Verifica que ejecutaste ambos archivos SQL en orden

### Error: "column 'beta_feedback_count' does not exist"  
- La migración de profiles no se aplicó
- Ejecuta manualmente `20260106_add_beta_tracking_to_profiles.sql`

### El botón de feedback no aparece
- Verifica que el servidor está corriendo
- Hard refresh (Cmd/Ctrl + Shift + R en web, o reinicia la app en móvil)
- Revisa la consola por errores de importación

### No puedo enviar feedback
- Verifica que estás logueado
- Revisa las RLS policies en Supabase
- Comprueba que tu usuario existe en la tabla `profiles`

## 6. Próximos Pasos

Ahora que el sistema de feedback está funcionando:

1. **Invita coaches beta**: Envíales el enlace de descarga + BETA_GUIDE.md
2. **Monitorea feedback**: Revisa regularmente la tabla `feedback` en Supabase
3. **Itera rápido**: Prioriza bugs críticos reportados
4. **Comunica**: Mantén informados a los beta testers sobre fixes y mejoras

## 7. Acceso al Dashboard Admin (Futuro)

Por ahora, revisa el feedback directamente en Supabase SQL Editor:

```sql
-- Ver todo el feedback ordenado por fecha
SELECT 
  f.id,
  p.full_name as user_name,
  f.feedback_type,
  f.description,
  f.screen_name,
  f.status,
  f.created_at
FROM feedback f
JOIN profiles p ON f.user_id = p.id
ORDER BY f.created_at DESC;

-- Contar por tipo
SELECT 
  feedback_type,
  COUNT(*) as count
FROM feedback
GROUP BY feedback_type;
```

En la próxima fase implementaremos un dashboard visual en la app para gestionar feedback más fácilmente.
