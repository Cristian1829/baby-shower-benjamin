# Invitación · Baby shower de Benjamin

Página de una sola hoja con tres pasos:

1. **Confirmar asistencia**: nombre, sí/no, adultos, niños y un mensaje para Benjamin.
2. **Lista de regalos**: cada regalo tiene tallas y cantidades. Cuando alguien aparta uno, el cupo baja para todos y nadie lo repite. La ropa va desde la talla 12 meses en adelante. Hay además una sugerencia opcional de llevar pañales: a cada invitado se le propone la etapa (2, 3 o 4) que va más atrasada, para que no lleguen todos de la misma talla (hoja "Pañales"; la proporción meta se cambia en `ETAPAS_PANAL` de `Codigo.gs`). Al final está la lluvia de sobres con la llave Bre-B para transferencias.
3. **Cómo llegar**: Google Maps, Waze y un botón para agregar al calendario.

Archivos:

- `index.html`: la página.
- `img/`: ilustración de animalitos superhéroes generada con Figma AI (ver `CREDITS.txt`).
- `apps-script/Codigo.gs`: el "servidor" gratuito en Google Sheets.

Publicada en: https://cristian1829.github.io/baby-shower-benjamin/

## 1. Conectar Google Sheets (para que la lista sea compartida)

Si no haces este paso, la página funciona en **modo de prueba**: cada persona ve su propia lista y no se evitan los repetidos.

1. Entra a <https://sheets.new> y ponle nombre, por ejemplo *Baby shower Benjamin*.
2. Menú **Extensiones → Apps Script**. Borra el contenido y pega todo `apps-script/Codigo.gs`. Guarda.
3. Arriba elige la función **setup** y pulsa **Ejecutar**. Acepta los permisos (Google avisa "app no verificada"; es tu propio script: *Configuración avanzada → Ir a…*).
   Se crean las hojas **Confirmaciones**, **Regalos** y **Apartados**.
4. **Implementar → Nueva implementación → tipo: Aplicación web**
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier persona**
5. Copia la URL que termina en `/exec` y pégala en `index.html`:

   ```js
   const API_URL = "https://script.google.com/macros/s/XXXXXXXX/exec";
   ```

Para cambiar el catálogo, edita la hoja **Regalos** (una fila por regalo y talla; la columna *ID* debe ser única). Los cambios se ven al recargar la página, sin volver a implementar.
Si cambias el código de `Codigo.gs`, ve a **Implementar → Administrar implementaciones → editar → Versión nueva** para que la URL siga igual.

## 2. Publicar en GitHub Pages

```powershell
gh repo create baby-shower-benjamin --public --source . --push
gh api -X POST repos/{owner}/baby-shower-benjamin/pages -f "source[branch]=main" -f "source[path]=/"
```

La invitación queda en `https://<tu-usuario>.github.io/baby-shower-benjamin/`.
Ten en cuenta que GitHub Pages es público: cualquiera con el enlace ve la dirección. La página pide a Google no indexarla, pero compártela solo por WhatsApp o mensaje directo.
