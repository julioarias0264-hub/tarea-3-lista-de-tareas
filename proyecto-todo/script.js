const formulario = document.getElementById('form-tarea');
const inputTarea = document.getElementById('input-tarea');
const inputFecha = document.getElementById('input-fecha');
const inputCategoria = document.getElementById('input-categoria');
const listaTareas = document.getElementById('lista-tareas');
const contadorPendientes = document.getElementById('contador-pendientes');
const botonesFiltro = document.querySelectorAll('.filtro');
const filtroCategoria = document.getElementById('filtro-categoria');
const btnGuardar = document.getElementById('btn-guardar');
const btnCancelar = document.getElementById('btn-cancelar');
const btnTema = document.getElementById('btn-tema');
const mensaje = document.getElementById('mensaje');
const categorias = ['Personal', 'Trabajo', 'Escuela', 'Otra'];
let tareas = [];
let filtroActual = 'todas';
let idEdicion = null;
const eliminando = new Set();

function avisar(texto) {
    mensaje.textContent = texto;
}

function guardarTareas() {
    try {
        localStorage.setItem('tareas', JSON.stringify(tareas));
    } catch {
        avisar('No se pudo guardar en el navegador. Mantén esta página abierta para conservar los cambios.');
    }
}

function cargarTareas() {
    try {
        const guardadas = JSON.parse(localStorage.getItem('tareas') || '[]');
        if (!Array.isArray(guardadas)) throw new Error('Formato inválido');
        tareas = guardadas.filter(t => t && typeof t.texto === 'string' && t.id != null).map(t => ({
            ...t,
            completada: Boolean(t.completada),
            fecha: /^\d{4}-\d{2}-\d{2}$/.test(t.fecha || '') ? t.fecha : '',
            categoria: categorias.includes(t.categoria) ? t.categoria : 'Personal'
        }));
    } catch {
        avisar('No se pudieron leer las tareas guardadas. Puedes comenzar una lista nueva.');
    }
    renderizarTareas();
}

// Se usan días de calendario locales; UTC evita desfases por horario de verano.
function diasHasta(fecha) {
    const hoy = new Date();
    const [ano, mes, dia] = fecha.split('-').map(Number);
    return Math.round((Date.UTC(ano, mes - 1, dia) - Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())) / 86400000);
}

function estadoFecha(tarea) {
    if (!tarea.fecha) return { clase: '', texto: 'Sin fecha límite' };
    const fecha = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
        .format(new Date(`${tarea.fecha}T12:00:00`));
    if (tarea.completada) return { clase: '', texto: fecha };
    const dias = diasHasta(tarea.fecha);
    if (dias < 0) return { clase: 'vencida', texto: `Vencida · ${fecha}` };
    if (dias === 0) return { clase: 'por-vencer', texto: 'Vence hoy' };
    if (dias === 1) return { clase: 'por-vencer', texto: 'Vence mañana' };
    if (dias <= 3) return { clase: 'por-vencer', texto: `Vence en ${dias} días · ${fecha}` };
    return { clase: '', texto: `Vence el ${fecha}` };
}

function cancelarEdicion() {
    idEdicion = null;
    formulario.reset();
    btnGuardar.textContent = 'Agregar tarea';
    btnCancelar.hidden = true;
    inputTarea.setCustomValidity('');
}

function editarTarea(tarea) {
    idEdicion = tarea.id;
    inputTarea.value = tarea.texto;
    inputFecha.value = tarea.fecha;
    inputCategoria.value = tarea.categoria;
    btnGuardar.textContent = 'Guardar cambios';
    btnCancelar.hidden = false;
    inputTarea.focus();
    avisar('Editando tarea. Guarda los cambios o cancela la edición.');
}

function eliminarTarea(tarea, fila) {
    if (eliminando.has(tarea.id)) return;
    eliminando.add(tarea.id);
    fila.classList.add('eliminando');
    fila.querySelectorAll('button, input').forEach(control => control.disabled = true);
    const terminar = () => {
        if (!eliminando.delete(tarea.id)) return;
        tareas = tareas.filter(t => t.id !== tarea.id);
        if (idEdicion === tarea.id) cancelarEdicion();
        avisar('Tarea eliminada.');
        guardarTareas();
        renderizarTareas();
    };
    fila.addEventListener('animationend', terminar, { once: true });
    // Respaldo para pestañas ocultas o movimiento reducido.
    setTimeout(terminar, 350);
}

function crearBoton(texto, accion, clase) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.textContent = texto;
    boton.className = clase;
    boton.addEventListener('click', accion);
    return boton;
}

function renderizarTareas() {
    listaTareas.replaceChildren();
    const visibles = tareas.filter(t =>
        (filtroActual === 'todas' || (filtroActual === 'completadas' ? t.completada : !t.completada)) &&
        (filtroCategoria.value === 'todas' || t.categoria === filtroCategoria.value)
    );
    visibles.forEach(tarea => {
        const fecha = estadoFecha(tarea);
        const li = document.createElement('li');
        li.className = `tarea ${tarea.completada ? 'completada' : ''} ${fecha.clase}`;
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = tarea.completada;
        checkbox.setAttribute('aria-label', `Marcar ${tarea.texto} como ${tarea.completada ? 'pendiente' : 'completada'}`);
        checkbox.addEventListener('change', () => {
            tarea.completada = checkbox.checked;
            guardarTareas();
            renderizarTareas();
        });
        const contenido = document.createElement('div');
        contenido.className = 'tarea-contenido';
        const texto = document.createElement('span');
        texto.className = 'tarea-texto';
        texto.textContent = tarea.texto;
        const detalles = document.createElement('p');
        detalles.className = 'tarea-detalles';
        // textContent muestra el texto del usuario sin interpretarlo como HTML.
        detalles.textContent = `${tarea.categoria} · ${fecha.texto}`;
        contenido.append(texto, detalles);
        const acciones = document.createElement('div');
        acciones.className = 'tarea-acciones';
        acciones.append(
            crearBoton('Editar', () => editarTarea(tarea), 'btn-editar'),
            crearBoton('Eliminar', () => eliminarTarea(tarea, li), 'btn-eliminar')
        );
        li.append(checkbox, contenido, acciones);
        if (eliminando.has(tarea.id)) {
            li.hidden = true;
        }
        listaTareas.append(li);
    });
    if (!visibles.length) {
        const vacio = document.createElement('li');
        vacio.className = 'sin-tareas';
        vacio.textContent = tareas.length ? 'No hay tareas con estos filtros.' : 'Tu lista está vacía. Agrega tu primera tarea arriba.';
        listaTareas.append(vacio);
    }
    contadorPendientes.textContent = tareas.filter(t => !t.completada).length;
}

formulario.addEventListener('submit', evento => {
    evento.preventDefault();
    const texto = inputTarea.value.trim();
    if (!texto) {
        inputTarea.setCustomValidity('Escribe una tarea; no puede contener solo espacios.');
        inputTarea.reportValidity();
        return;
    }
    const datos = { texto, fecha: inputFecha.value, categoria: inputCategoria.value };
    if (idEdicion !== null) {
        tareas = tareas.map(t => t.id === idEdicion ? { ...t, ...datos } : t);
        avisar('Cambios guardados.');
    } else {
        tareas.unshift({ id: crypto.randomUUID(), ...datos, completada: false });
        avisar('Tarea agregada.');
    }
    guardarTareas();
    cancelarEdicion();
    renderizarTareas();
    inputTarea.focus();
});
inputTarea.addEventListener('input', () => inputTarea.setCustomValidity(''));
btnCancelar.addEventListener('click', () => {
    cancelarEdicion();
    avisar('Edición cancelada.');
    inputTarea.focus();
});
botonesFiltro.forEach(boton => boton.addEventListener('click', () => {
    filtroActual = boton.dataset.filtro;
    botonesFiltro.forEach(b => {
        b.classList.toggle('activo', b === boton);
        b.setAttribute('aria-pressed', String(b === boton));
    });
    renderizarTareas();
}));
filtroCategoria.addEventListener('change', renderizarTareas);

function aplicarTema(oscuro) {
    document.documentElement.dataset.tema = oscuro ? 'oscuro' : 'claro';
    btnTema.textContent = oscuro ? 'Modo claro' : 'Modo oscuro';
    btnTema.setAttribute('aria-pressed', String(oscuro));
}
btnTema.addEventListener('click', () => {
    const oscuro = document.documentElement.dataset.tema !== 'oscuro';
    aplicarTema(oscuro);
    try { localStorage.setItem('tema', oscuro ? 'oscuro' : 'claro'); }
    catch { avisar('El tema se aplicó, pero no se pudo guardar la preferencia.'); }
});
try { aplicarTema(localStorage.getItem('tema') === 'oscuro'); }
catch { aplicarTema(false); }
cargarTareas();
// Actualiza los avisos de vencimiento si la página permanece abierta.
setInterval(renderizarTareas, 60000);
