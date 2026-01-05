# Análisis de Validaciones para Sesiones con Múltiples Coaches

## Contexto
Se ha incorporado la posibilidad de que existan múltiples coaches en el sistema mediante el campo `instructor_id` en las sesiones. Esto requiere revisar y actualizar todas las validaciones de conflictos.

## Estructura Actual de Datos

### Sesión (Session)
- `id`: string
- `coach_id`: string (propietario de la sesión - el coach que la creó)
- `instructor_id`: string | null (el coach asignado para dar la clase - puede ser diferente al propietario)
- `scheduled_at`: Date
- `duration_minutes`: number
- `location`: string | null (ubicación general, ej: "Club X")
- `court`: string | null (cancha específica, ej: "Cancha 1")
- `player_ids`: string[] (relación many-to-many a través de `session_players`)
- `status`: SessionStatus

### Relaciones
- `session_players`: tabla de unión entre sessions y players
- Un coach puede crear sesiones para otros instructores
- Una sesión puede tener múltiples alumnos

## Escenarios de Conflicto a Validar

### 1. **Conflicto de Alumno** ⚠️ CRÍTICO
**Regla:** Un mismo alumno NO puede estar en dos sesiones al mismo tiempo, independientemente de:
- La ubicación
- La cancha
- El coach/instructor
- Quién creó la sesión

**Validación Actual:** ✅ Implementada (línea 113-119 en useSessions.ts)
```typescript
// Verifica si algún player_id está en ambas sesiones cuando los horarios se solapan
```

**Estado:** **CORRECTA** - No requiere cambios porque ya valida solo por alumno y horario.

---

### 2. **Conflicto de Ubicación + Cancha** ⚠️ REQUIERE ACTUALIZACIÓN
**Regla:** No pueden existir dos sesiones en la misma ubicación Y en la misma cancha al mismo tiempo.

**Casos a considerar:**
- ✅ **PERMITIDO:** Dos sesiones en "Club X" con diferentes canchas ("Cancha 1" vs "Cancha 2")
- ❌ **PROHIBIDO:** Dos sesiones en "Club X", "Cancha 1" al mismo tiempo
- ⚠️ **EDGE CASE:** ¿Qué pasa si `court` es null o vacío?

**Validación Actual:** ❌ Incompleta (línea 121-125 en useSessions.ts)
```typescript
// Solo valida location, NO valida court
if (location && session.location &&
    location.toLowerCase().trim() === session.location.toLowerCase().trim()) {
    result.locationConflict = true;
}
```

**Estado:** **REQUIERE ACTUALIZACIÓN**

**Propuesta de Corrección:**
```typescript
// Caso 1: Si ambas sesiones tienen ubicación Y cancha definidas
if (location && court && session.location && session.court) {
    if (location.toLowerCase().trim() === session.location.toLowerCase().trim() &&
        court.toLowerCase().trim() === session.court.toLowerCase().trim()) {
        result.locationConflict = true;
    }
}
// Caso 2: Si alguna sesión tiene ubicación pero NO tiene cancha
// Consideramos que ocupa TODA la ubicación (cualquier cancha)
else if (location && session.location &&
         location.toLowerCase().trim() === session.location.toLowerCase().trim()) {
    // Si alguna de las dos no tiene cancha específica, hay conflicto
    if (!court || !session.court) {
        result.locationConflict = true;
    }
}
```

---

### 3. **Conflicto de Instructor** 🆕 NUEVA VALIDACIÓN
**Regla:** Un mismo instructor NO puede estar dando dos clases al mismo tiempo.

**Casos a considerar:**
- Un coach crea una sesión y se asigna a sí mismo (`instructor_id = null` o `instructor_id = coach_id`)
- Un coach crea una sesión y asigna a otro instructor (`instructor_id = staff_member_id`)
- Dos coaches diferentes crean sesiones asignadas al mismo instructor

**Validación Actual:** ❌ NO implementada

**Estado:** **REQUIERE IMPLEMENTACIÓN**

**Propuesta de Implementación:**
```typescript
// En la interfaz ConflictResult, agregar:
export interface ConflictResult {
    playerConflicts: string[];
    locationConflict: boolean;
    instructorConflict: boolean; // 🆕 NUEVO
}

// En checkSessionConflicts, agregar parámetro:
export const checkSessionConflicts = async (
    coachId: string,
    playerIds: string[],
    scheduledAt: Date,
    durationMinutes: number,
    location: string | null,
    court: string | null, // 🆕 AGREGAR
    instructorId: string | null, // 🆕 AGREGAR
    excludeSessionId?: string
): Promise<ConflictResult> => {
    // ...
    
    // Determinar el instructor efectivo
    const effectiveInstructorId = instructorId || coachId;
    
    // NUEVA VALIDACIÓN: Buscar sesiones donde el mismo instructor esté asignado
    for (const session of otherSessions) {
        const sessionEffectiveInstructorId = session.instructor_id || session.coach_id;
        
        if (timesOverlap && 
            sessionEffectiveInstructorId === effectiveInstructorId) {
            result.instructorConflict = true;
        }
    }
}
```

---

### 4. **Validaciones Multi-Coach a Considerar** 🤔

#### 4.1 Ubicación sin Cancha + Múltiples Coaches
**Escenario:** 
- Coach A crea sesión: "Club X", sin cancha especificada, 10:00-11:00
- Coach B crea sesión: "Club X", "Cancha 1", 10:00-11:00

**Pregunta:** ¿Es conflicto?

**Opciones:**
1. **Opción A (Restrictiva):** SÍ es conflicto - si no especificas cancha, reservas toda la ubicación
2. **Opción B (Permisiva):** NO es conflicto - solo hay conflicto si ambas especifican la misma cancha

**Recomendación:** Opción A (más segura) - implementada en la propuesta del punto 2

#### 4.2 Consultar Sesiones de TODOS los Coaches
**Problema Actual:** La función `checkSessionConflicts` solo consulta sesiones donde `coach_id = coachId`
```typescript
.eq('coach_id', coachId)  // ❌ PROBLEMA: Solo busca en sesiones del mismo coach
```

**Implicación:** Si Coach A y Coach B intentan crear sesiones con conflicto, no se detectará porque cada uno solo ve sus propias sesiones.

**Estado:** **REQUIERE ACTUALIZACIÓN CRÍTICA** ⚠️⚠️⚠️

**Propuesta de Corrección:**
```typescript
// ELIMINAR el filtro por coach_id
const { data: sessions, error } = await supabase
    .from('sessions')
    .select(`
        id,
        coach_id,
        instructor_id,
        scheduled_at,
        duration_minutes,
        location,
        court,
        session_players(player_id)
    `)
    // .eq('coach_id', coachId)  // ❌ ELIMINAR ESTA LÍNEA
    .gte('scheduled_at', dayStart.toISOString())
    .lte('scheduled_at', dayEnd.toISOString())
    .neq('status', 'cancelled');
```

---

## Resumen de Cambios Necesarios

### 🔴 CRÍTICOS (Bloquean funcionalidad multi-coach)
1. **Eliminar filtro `coach_id`** en `checkSessionConflicts` - permite detectar conflictos entre coaches
2. **Agregar parámetro `court`** a `checkSessionConflicts`
3. **Agregar validación de instructor** - nuevo campo en ConflictResult

### 🟡 IMPORTANTES (Mejoran precisión)
4. **Actualizar lógica de conflicto de ubicación** - considerar ubicación + cancha
5. **Manejar casos edge** - ubicación sin cancha

### 🟢 MENSAJES
6. **Agregar mensajes de traducción** para nuevo conflicto de instructor
7. **Actualizar mensaje de ubicación** para mencionar cancha cuando aplique

---

## Nuevos Mensajes de Traducción Requeridos

### Español (es.json)
```json
{
  "instructorConflictMessage": "El instructor {{instructor}} ya tiene una clase programada en este horario",
  "locationAndCourtConflictMessage": "La ubicación {{location}}, cancha {{court}} ya tiene una clase programada en este horario"
}
```

### Inglés (en.json)
```json
{
  "instructorConflictMessage": "Instructor {{instructor}} already has a session scheduled at this time",
  "locationAndCourtConflictMessage": "Location {{location}}, court {{court}} already has a session scheduled at this time"
}
```

---

## Plan de Implementación Sugerido

### Paso 1: Actualizar Tipos
- [ ] Agregar `instructorConflict: boolean` a `ConflictResult`
- [ ] Actualizar firma de `checkSessionConflicts`

### Paso 2: Actualizar Lógica de Validación
- [ ] Eliminar filtro `eq('coach_id', coachId)`
- [ ] Agregar validación de instructor
- [ ] Actualizar validación de ubicación + cancha
- [ ] Agregar campo `court` en la consulta SELECT

### Paso 3: Actualizar Formularios
- [ ] Pasar parámetro `court` a `checkSessionConflicts` en `new.tsx`
- [ ] Pasar parámetro `instructorId` a `checkSessionConflicts` en `new.tsx`
- [ ] Agregar manejo del nuevo conflicto `instructorConflict`
- [ ] Repetir para formulario de edición (si existe)

### Paso 4: Actualizar Traducciones
- [ ] Agregar nuevos mensajes a `es.json`
- [ ] Agregar nuevos mensajes a `en.json`

### Paso 5: Testing
- [ ] Probar conflicto alumno (misma funcionalidad)
- [ ] Probar conflicto ubicación + cancha
- [ ] Probar conflicto instructor
- [ ] Probar escenarios multi-coach
- [ ] Probar casos edge (campos null/vacíos)

---

## Casos de Prueba Recomendados

### Test 1: Conflicto de Alumno
- Coach A crea sesión con Alumno X, 10:00-11:00, "Club A"
- Coach B intenta crear sesión con Alumno X, 10:00-11:00, "Club B"
- **Resultado esperado:** ❌ Error - conflicto de alumno

### Test 2: Mismo Lugar, Diferente Cancha
- Coach A crea sesión en "Club A", "Cancha 1", 10:00-11:00
- Coach B intenta crear sesión en "Club A", "Cancha 2", 10:00-11:00
- **Resultado esperado:** ✅ Permitido (diferentes canchas)

### Test 3: Mismo Lugar, Misma Cancha
- Coach A crea sesión en "Club A", "Cancha 1", 10:00-11:00
- Coach B intenta crear sesión en "Club A", "Cancha 1", 10:00-11:00
- **Resultado esperado:** ❌ Error - conflicto de ubicación y cancha

### Test 4: Conflicto de Instructor
- Coach A crea sesión asignada a Instructor X, 10:00-11:00
- Coach B intenta crear sesión asignada a Instructor X, 10:00-11:00
- **Resultado esperado:** ❌ Error - conflicto de instructor

### Test 5: Ubicación sin Cancha
- Coach A crea sesión en "Club A" (sin cancha), 10:00-11:00
- Coach B intenta crear sesión en "Club A", "Cancha 1", 10:00-11:00
- **Resultado esperado:** ❌ Error - conflicto de ubicación (la primera reserva toda la ubicación)

### Test 6: Auto-asignación de Instructor
- Coach A crea sesión sin especificar instructor (se asigna a sí mismo), 10:00-11:00
- Coach A intenta crear otra sesión sin especificar instructor, 10:00-11:00
- **Resultado esperado:** ❌ Error - conflicto de instructor (consigo mismo)

---

## Notas Adicionales

### Consideración de Performance
Al eliminar el filtro `coach_id`, la consulta podría volverse más lenta en sistemas con muchas sesiones. Consideraciones:
1. El filtro por fecha (`dayStart` a `dayEnd`) limita significativamente los resultados
2. Se recomienda agregar un índice en la columna `scheduled_at` si no existe
3. Si el rendimiento es un problema, considerar agregar índice compuesto: `(scheduled_at, location, court)`

### RLS (Row Level Security)
Verificar que las políticas RLS permitan:
1. Un coach puede leer sesiones de otros coaches (para validar conflictos)
2. Un coach NO puede modificar sesiones de otros coaches
3. Un coach puede leer información de instructors/staff para mostrar nombres en mensajes de error
