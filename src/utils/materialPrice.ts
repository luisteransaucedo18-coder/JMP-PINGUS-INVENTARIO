export const formatPrecio = (precio: number) =>
  precio > 0
    ? new Intl.NumberFormat('es-PE', {
        style: 'currency',
        currency: 'PEN',
        minimumFractionDigits: 2,
      }).format(precio)
    : 'Sin precio';
