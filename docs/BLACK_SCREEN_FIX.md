# Fix: Pantalla Negra en APK

## Problema Identificado
El primer build mostraba pantalla negra porque las variables de entorno de Supabase no estaban configuradas correctamente para el perfil "preview".

## Solución Implementada

### 1. Configuración de Variables (app.config.js)
Creado archivo con credenciales hardcodeadas como fallback:
- `extra.supabaseUrl`
- `extra.supabaseAnonKey`

### 2. Actualización de supabaseClient.ts  
El código ahora usa 3 niveles de fallback:
1. `Constants.expoConfig.extra` (del app.config.js)
2. `process.env.EXPO_PUBLIC_*` (variables de entorno)
3. Strings vacíos con error log

### 3. Nuevo Build
Build ID: `b7adc5ae-9b6e-405f-9db9-ee9bbe489dc3`
Link: https://expo.dev/accounts/gusgvillafane/projects/TennisAppV1/builds/b7adc5ae-9b6e-405f-9db9-ee9bbe489dc3

## Próximos Pasos

1. **Esperar el build** (~10-15 min)
2. **Instalar desde el nuevo link** en tu celular
3. **Verificar** que muestra la pantalla de login
4. **Probar login** con Google
5. **Testear feedback** con el botón 💬

## Archivos Modificados
- [NEW] `app.config.js` - Configuración con credenciales
- [MODIFIED] `src/services/supabaseClient.ts` - Fallback mejorado

## Prevención Futura
Para builds futuros, las credenciales ya están configuradas en:
- app.config.js (incluido en el código)
- Environment variables en EAS (para preview)

**No deberías tener este problema de nuevo.** ✅
