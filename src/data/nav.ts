export interface NavItem {
  href: string;
  label: string;
  children?: { href: string; label: string; desc?: string }[];
}

export const NAV: NavItem[] = [
  { href: '/', label: 'Inicio' },
  { href: '/servicios/', label: 'Servicios' },
  { href: '/servicios/reconstruccion-3d-de-hechos/', label: 'Reconstrucción 3D' },
  { href: '/cursos/', label: 'Capacitación' },
  {
    href: '/blog/',
    label: 'Recursos',
    children: [
      { href: '/blog/', label: 'Blog forense', desc: 'Artículos de criminalística' },
      { href: '/glosario/', label: 'Glosario forense', desc: 'Términos explicados de la A a la Z' },
      { href: '/biblioteca/', label: 'Biblioteca forense', desc: 'Libros y equipo recomendados' },
      { href: '/manual-dactiloscopia/', label: 'Manual de dactiloscopia', desc: 'Gratis' },
      { href: '/manual-identificacion-forense-de-la-voz/', label: 'Manual de voz', desc: 'Gratis' },
    ],
  },
  { href: '/nosotros/', label: 'Nosotros' },
  { href: '/contacto/', label: 'Contacto' },
];
