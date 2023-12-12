const express = require('express');
const app = express();
const { Pool } = require('pg');
const cors = require('cors');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const dbConfig = {
  user: 'vladimiroc20',
  password: '12590288',
  host: 'localhost',
  port: 5432,
  database: 'db_cotizador',
};

const pool = new Pool(dbConfig);

app.use((req, res, next) => {
  req.pool = pool;
  next();
});

const PORT = process.env.PORT || 3001;

// Middleware para manejar errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});

// Función auxiliar para manejar consultas a la base de datos
const query = async (sql, params = []) => {
  try {
    const result = await pool.query(sql, params);
    return result.rows;
  } catch (error) {
    console.error('Error executing query:', error);
    throw error;
  }
};

// Ruta para obtener todas las cotizaciones con información de usuarios y clientes
app.get('/cotizaciones', async (req, res, next) => {
  try {
    const sql = `
      SELECT c.IDCotizacion, c.Fecha, u.NombreCompleto AS Cotizador, cl.NombreCompleto AS Cliente, c.Valor
      FROM Cotizaciones c
      INNER JOIN Usuarios u ON c.CorreoUsuario = u.Correo
      INNER JOIN Clientes cl ON c.IDCliente = cl.IDCliente
    `;
    const cotizaciones = await query(sql);
    res.json(cotizaciones);
  } catch (error) {
    next(error);
  }
});

// Ruta para obtener usuarios
app.get('/usuarios', async (req, res, next) => {
  try {
    const sql = 'SELECT * FROM usuarios';
    const usuarios = await query(sql);
    res.json(usuarios);
  } catch (error) {
    next(error);
  }
});

// Ruta para obtener clientes
app.get('/clientes', async (req, res, next) => {
  try {
    const sql = 'SELECT * FROM clientes';
    const clientes = await query(sql);
    res.json(clientes);
  } catch (error) {
    next(error);
  }
});

// Ruta para obtener servicios
app.get('/servicios', async (req, res, next) => {
  try {
    const sql = 'SELECT * FROM servicios';
    const servicios = await query(sql);
    res.json(servicios);
  } catch (error) {
    next(error);
  }
});

// Ruta para obtener servicios activos
app.get('/servicios-activos', async (req, res, next) => {
  try {
    const sql = 'SELECT idservicio as id, * FROM servicios WHERE activo = TRUE';
    const serviciosActivos = await query(sql);
    res.json(serviciosActivos);
  } catch (error) {
    next(error);
  }
});

// Ruta para activar un servicio por su ID
app.patch('/servicios/activar/:id', async (req, res, next) => {
  const { id } = req.params;
  try {
    const sql = 'UPDATE servicios SET activo = TRUE WHERE idservicio = $1';
    await query(sql, [id]);
    res.status(200).json({ message: 'Servicio activado correctamente' });
  } catch (error) {
    next(error);
  }
});

// Ruta para desactivar un servicio por su ID
app.patch('/servicios/desactivar/:id', async (req, res, next) => {
  const { id } = req.params;
  try {
    const sql = 'UPDATE servicios SET activo = FALSE WHERE idservicio = $1';
    await query(sql, [id]);
    res.status(200).json({ message: 'Servicio desactivado correctamente' });
  } catch (error) {
    next(error);
  }
});

// Ruta para agregar un nuevo servicio
app.post('/servicios', async (req, res, next) => {
  const { nombreservicio, valor } = req.body;
  // Validar que se proporcionaron los datos necesarios
  if (!nombreservicio || !valor) {
    return res.status(400).json({ error: 'Por favor, proporcione un nombre y un precio para el servicio.' });
  }

  try {
    const sql = 'INSERT INTO servicios (nombreservicio, valor, activo) VALUES ($1, $2, $3) RETURNING *';
    const nuevoServicio = await query(sql, [nombreservicio, valor, true]);
    res.status(201).json(nuevoServicio[0]);
  } catch (error) {
    next(error);
  }
});

// Ruta para obtener cotizaciones por fecha
app.get('/cotizacionesPorFecha', async (req, res, next) => {
  const { fecha } = req.query;
  try {
    const sql = `
      SELECT c.IDCotizacion, c.Fecha, u.NombreCompleto AS Cotizador, cl.NombreCompleto AS Cliente, c.Valor
      FROM Cotizaciones c
      INNER JOIN Usuarios u ON c.CorreoUsuario = u.Correo
      INNER JOIN Clientes cl ON c.IDCliente = cl.IDCliente
      WHERE c.Fecha = $1
    `;
    const cotizacionesPorFecha = await query(sql, [fecha]);
    res.json(cotizacionesPorFecha);
  } catch (error) {
    next(error);
  }
});

// Ruta para generar cotizaciones
app.post('/generar-cotizacion', async (req, res, next) => {
  const { nombreCliente, tipoDocumento, numeroDocumento, telefono, correoCliente, nombreCotizador, correoCotizador, serviciosSeleccionados } = req.body;

  try {
    const valorTotal = serviciosSeleccionados.reduce((total, servicio) => total + (servicio.valor * servicio.cantidad), 0);

    const client = await pool.connect();
    try {
      const sqlInsertCliente = `
        INSERT INTO Clientes (NombreCompleto, TipoDocumento, NumeroIdentidad, Celular, Correo)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING IDCliente;
      `;
      const resultCliente = await client.query(sqlInsertCliente, [nombreCliente, tipoDocumento, numeroDocumento, telefono, correoCliente]);

      if (resultCliente.rows.length > 0) {
        const idCliente = resultCliente.rows[0].idcliente; // Utiliza el IDCliente generado automáticamente

        // Verifica si el correo del cotizador proporcionado existe en la tabla "usuarios"
        const usuarioCotizadorExistente = await client.query('SELECT correo FROM usuarios WHERE correo = $1', [correoCotizador]);
        
        if (usuarioCotizadorExistente.rows.length > 0) {
          const sqlInsertCotizacion = `
            INSERT INTO Cotizaciones (correousuario, idcliente, nombrecotizador, nombrecliente, valor)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING idcotizacion;
          `;
          const resultCotizacion = await client.query(sqlInsertCotizacion, [correoCotizador, idCliente, nombreCotizador, nombreCliente, valorTotal]);

          if (resultCotizacion.rows.length > 0) {
            const idCotizacion = resultCotizacion.rows[0].idcotizacion; // Utiliza el IDCotizacion generado automáticamente

            for (const servicio of serviciosSeleccionados) {
              const sqlInsertCotizacionServicio = `
                INSERT INTO CotizacionServicios (IDCotizacion, IDServicio, Cantidad)
                VALUES ($1, $2, $3);
              `;
              await client.query(sqlInsertCotizacionServicio, [idCotizacion, servicio.id, servicio.cantidad]);
            }

            await client.query('COMMIT');
            res.status(201).json({ message: 'Cotización generada correctamente', idCotizacion });
          } else {
            res.status(500).json({ error: 'No se pudo generar la cotización.' });
          }
        } else {
          res.status(400).json({ error: 'El correo del cotizador proporcionado no está registrado.' });
        }
      } else {
        res.status(500).json({ error: 'No se pudo insertar el cliente.' });
      }
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});


// Ruta para obtener correos de usuarios encargados
app.get('/usuarios-encargados', async (req, res, next) => {
  try {
    const sql = 'SELECT correo FROM usuarios';
    const usuariosEncargados = await query(sql);
    res.json(usuariosEncargados);
  } catch (error) {
    next(error);
  }
});

app.listen(PORT, () => {
  console.log(`Escuchando en el puerto ${PORT}`);
});

