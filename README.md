# DoorPick

Tengo que desarrollar una aplicación para una línea de producción de paneles de puerta, específicamente para el último puesto de la misma (revisión pre-calidad).

Actualmente, la línea de producción utiliza las siguientes convenciones: un número de secuencia para identificar el vehículo, y un código adicional para identificar el tipo de panel que se está trabajando. El número de secuencia es un número del 1 al 999, y el código del panel es FRLH (Front Left Hand), FRRH (Front Right Hand), RRLH (Rear Left Hand), RRHH (Rear Right Hand).

La línea de producción siempre utiliza números de secuencia consecutivos, y dentro de una misma secuencia, se trabajan primero los paneles delanteros (FRLH y FRRH) y luego los paneles traseros (RRLH y RRHH). El vehículo puede ser cabina simple o doble, por lo que no todas las secuencias tienen paneles traseros. Existen múltiples estilos de paneles, pero todos los paneles de una misma secuencia siempre utilizan el mismo estilo.

El trabajo se realiza en dos líneas paralelas (A y B) que trabajan simultáneamente, cada una con su propio operario. Sin embargo, ambas trabajan las mismas secuencias (es decir, entre las dos líneas se trabajan todos los paneles para un mismo vehículo): por ejemplo, mientras un operario trabaja un panel LH (Left Hand), el otro operario trabaja un panel RH (Right Hand).

En la aplicación debe ser posible configurar, para cada línea (A o B), qué paneles se desea trabajar. Esto brinda flexibilidad:

- Hoy la línea A produce FRLH y RRRH, mientras que la línea B produce FRRH y RRLH.
- Mañana cambia la forma de trabajar, y la línea A produce FRLH y RRLH, mientras que la línea B produce FRRH y RRHH.
- La semana que viene se rompe la línea B, y la línea A debe producir todos los paneles (FRLH, FRRH, RRLH y RRHH).

Como se explico antes, si hubieran demoras en la producción, un superior puede decidir que se utilicen paneles del stock de seguridad, omitiendo secuencias en la línea de producción. Por ejemplo, supongamos que al comienzo del día se solicitó producción de las secuencias 1, 2, 3, 4 y 5, pero debido a un retraso, el superior decidió que los paneles correspondientes a las secuencias 3 y 4 se tomen del stock de seguridad. Los pasos a seguir por los operarios serían los siguientes:

1. Secuencia 1
    1. Tomar panel delantero de la etapa anterior de la línea de producción.
    2. Si el vehículo es doble cabina, tomar panel trasero de la etapa anterior de la línea de producción.
2. Secuencia 2
    1. Tomar panel delantero de la etapa anterior de la línea de producción.
    2. Si el vehículo es doble cabina, tomar panel trasero de la etapa anterior de la línea de producción.
3. Secuencia 3
    1. Tomar panel delantero del stock de seguridad.
    2. Si el vehículo es doble cabina, tomar panel trasero del stock de seguridad.
4. Secuencia 4
    1. Tomar panel delantero del stock de seguridad.
    2. Si el vehículo es doble cabina, tomar panel trasero del stock de seguridad.
5. Secuencia 5
    1. Tomar panel delantero de la etapa anterior de la línea de producción.
    2. Si el vehículo es doble cabina, tomar panel trasero de la etapa anterior de la línea de producción.

Como se puede ver, al final de la línea, los paneles deben siempre llegar respetando el orden de secuencia, y dentro de cada secuencia, respetando el orden de paneles (delanteros primero, traseros después).

La aplicación debe ser versatil, permitiendo omitir secuencias completas, o solo paneles específicos. Por ejemplo, si hay demoras en la línea, se pueden omitir secuencias completas para permitirle a la línea recuperar el ritmo; si faltan insumos para paneles delanteros, se pueden omitir solo los paneles delanteros de las secuencias deseadas; o si faltan insumos específicamente de paneles traseros izquierdos (RRLH), se pueden omitir solo esos paneles de las secuencias deseadas.

---

La aplicación debe realizar dos tareas principales:

- Llevar un registro de qué panel se está trabajando actualmente. Esto permite que, si el operario se olvida de qué panel estaba trabajando, pueda consultarlo y continuar con su trabajo sin problemas. Lo mismo aplica si otro operario necesita retomar el trabajo durante la jornada. También permite saber cuál es el siguiente panel que se debe trabajar.
- Indicarle al operario de dónde tomar el siguiente panel a trabajar: desde la etapa anterior de la línea de producción, o desde el stock de seguridad. Esta indicación debe ser clara, rápida, precisa, intuitiva y fácil de entender. Es importante evitar confusiones para evitar errores y demoras.

Por lo tanto, la interfaz de la aplicación será sencilla, con pocos elementos visuales, visibles incluso a distancia, utilizando colores que permitan identificar rápidamente el estado de la producción y la ubicación de los paneles.

En el día a día, la única interacción manual que debería realizar el operario con el teclado y el mouse es abrir la aplicación. Debe haber un apartado de configuración, donde se puedan establecer los parámetros de funcionamiento, pero solo se utilizaría en situaciones excepcionales.

Para indicar que tomó un panel, el operario utiliza un escáner de códigos QR. Al escanear el código del panel, la aplicación registra automáticamente que ese panel fue tomado, y, si es el correcto, actualiza el estado de la producción.

La interfaz debe tener un selector A/B, para indicar en qué línea se encuentra el operario. Debe mostrar, para dicha línea, los 5 paneles que se deben trabajar a continuación (número de secuencia y tipo de panel), indicando claramente si se deben tomar de la etapa anterior de la línea de producción (DOBLADORA) o del stock de seguridad (STOCK). Al escanear un panel, si es correcto debe marcarse en verde, y luego de 10 segundos, eliminar ese panel de la lista de 5 elementos y agregar el siguiente; si es incorrecto, debe marcarse en rojo y permanecer en la lista hasta que se escanee el panel correcto.

La interfaz será utilizada en monitores (computadoras de escritorio), por lo que el diseño de la aplicación en dispositivos móviles es irrelevante.

Dividí la pantalla en 2 secciones: la izquierda muestra la lista de paneles a trabajar, y la derecha muestra el estado:

- Si se está esperando un panel, indicarlo, junto con la ubicación de dónde tomarlo (DOBLADORA o STOCK). Como STOCK es la excepción, debe resaltarse en amarillo.
- Si el panel escaneado es el correcto, indicarlo en verde.
- Si el panel escaneado es incorrecto, indicarlo en rojo.

---

La base de datos a utilizar es Microsoft SQL Server 2022, y la aplicación debe estar desarrollada con Next.js.

Los datos del resto de la línea de producción necesarios para el funcionamiento de la aplicación se encuentran en la tabla `dbo.Orden_Produccion`; ÚNICAMENTE podés LEER esta tabla, nunca escribir en ella. Las columas relevantes de la tabla son ID_OrdenProduccion (entero positivo), Secuencia (entero positivo), Fecha_Proceso, Puesto (las únicas filas relevantes contienen DL01), Estado (0/1), Mano (LH/RH), Posicion (FR/RR).

Si el estado es 0, el panel viene de la etapa anterior de la linea de producción. Si el estado es 1, el panel debe ser tomado del stock de seguridad.

```sql
SELECT 
    [ID_OrdenProduccion],
    [Secuencia],
    [Fecha_Proceso],
    [Mano],
    [Posicion]
FROM [TB-L].[dbo].[Orden_Produccion]
WHERE Puesto = 'DL01'
  AND [Fecha_Proceso] > @FECHA_INICIO_EVALUACION
ORDER BY [Secuencia] ASC;
```

FECHA_INICIO_EVALUACION es la fecha a partir de la cual se quiere evaluar paneles, una variable que debe ser configurable en la configuración del sistema. Cualquier panel con fecha de proceso anterior a la misma representa producción realizada antes de la implementación del sistema.

Aquellas cosas que necesite la aplicación que no se encuentren en la tabla `dbo.Orden_Produccion`, deberán ser almacenadas en una nueva tabla `dbo.DoorPick`.

El flujo de ejecución básico de la aplicación consiste en leer `dbo.Orden_Produccion` con la query especificada anteriormente, para obtener un listado de tanto los paneles ya procesados como los paneles a procesar (los paneles que interesa mostrar son los 5 siguientes). A medida que el operario toma paneles y los escanea, almacenar su ID_OrdenProduccion en `dbo.DoorPick`, para registrar que ya fue procesado y no debe ser incluído en los paneles a mostrar; también se debe guardar la fuente de ese panel: "linea" si proviene de la etapa anterior de la línea de producción, o "stock" si proviene del stock de seguridad.

---

Los aspectos configurables de la aplicación deben ser los siguientes.

- Paneles a procesar (FRLH, FRRH, RRLH, RRRH) por línea A, y paneles a peocesar por línea B, mutuamente exclusivos (un tipo de panel solo puede ser procesado por A, por B, o por ninguna, pero nunca por ambas).
- La fecha a partir de la cual se desea evaluar paneles, ignorando todos los paneles anteriores a la misma.