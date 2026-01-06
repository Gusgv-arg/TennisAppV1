# Guía Rápida - Beta Testing

## ✅ Build Completado

**Link del build:**
https://expo.dev/accounts/gusgvillafane/projects/TennisAppV1/builds/891f7e9b-cb51-4318-b287-f177b5b0e21d

---

## 📱 Distribución a Profesores

### Compartir el APK
1. Envía el link del build por WhatsApp/Email
2. Los profesores abren el link desde Android
3. Tocan "Install"
4. Aceptan permisos de instalación
5. Abren la app y se registran con Google

### Mensaje Sugerido
```
¡Hola! Te invito a probar TennisApp Beta 🎾

Link de instalación:
https://expo.dev/accounts/gusgvillafane/projects/TennisAppV1/builds/891f7e9b-cb51-4318-b287-f177b5b0e21d

Pasos:
1. Abre el link desde tu Android
2. Toca "Install" 
3. Acepta instalar desde fuentes desconocidas
4. Abre la app y registrate con Google

Usa el botón 💬 en la app para reportar bugs o sugerencias.

Adjunto: BETA_GUIDE.md con más info
```

---

## 🔄 Actualizaciones (MUY IMPORTANTE)

### ❌ NO hagas esto cada vez:
```bash
eas build --platform android --profile preview  # ❌ Solo para primer build
```

### ✅ Para actualizar después de cambios:
```bash
# 1. Haces tus cambios en el código
# 2. Publicas la actualización:
eas update --branch preview --message "Fix en calendario"

# Los profesores:
# - Abren la app
# - Se actualiza sola en 5-10 segundos
# - ¡Sin reinstalar nada!
```

### Ejemplo de Flujo Normal:
```bash
# Lunes: Recibes feedback de bug en calendario
# 1. Arreglas el código
# 2. Ejecutas:
eas update --branch preview --message "Corregido bug en calendario"

# 3. Avisas a los profesores:
# "Actualización disponible, cierren y abran la app"

# 4. ¡Listo! Todos tienen el fix en segundos
```

---

## 📊 Monitorear Builds y Updates

### Ver todos tus builds:
```bash
eas build:list
```

### Ver estado de updates:
```bash
eas update:list --branch preview
```

### Ver quién descargó qué:
- Ve a: https://expo.dev/accounts/gusgvillafane/projects/TennisAppV1
- Sección "Updates"

---

## 🐛 Troubleshooting

### "No puedo instalar el APK"
- Verificar que permiten "Fuentes desconocidas"
- En Configuración → Seguridad → permitir instalación

### "La app no se actualiza"
- Cerrar completamente la app
- Volver a abrir
- Esperar 10 segundos

### "Quiero forzar actualización"
```bash
eas update --branch preview --message "Actualización forzada"
```

---

## 📝 Checklist Primera Distribución

- [x] Build creado exitosamente
- [ ] Aplicar migraciones en Supabase (ver BETA_SETUP.md)
- [ ] Probar app en tu celular
- [ ] Probar botón de feedback
- [ ] Enviar a 2-3 profesores de confianza primero
- [ ] Esperar feedback inicial
- [ ] Expandir a más testers

---

## 🚀 Próximos Pasos Sugeridos

1. **HOY**: Aplica las migraciones de feedback en Supabase
2. **HOY**: Instala y prueba la app en tu celular
3. **MAÑANA**: Envía a 2-3 profesores cercanos
4. **SEMANA 1**: Recibe y procesa primeros feedbacks
5. **SEMANA 2**: Expande a 5-10 profesores más

**¡La infraestructura beta está lista! 🎾**
