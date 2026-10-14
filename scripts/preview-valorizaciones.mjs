// Isolated visual fixture; no authentication, uploads or writes to Supabase.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
const folder = "test-results/valorizaciones"
mkdirSync(folder, { recursive: true })
let source = readFileSync(
  "src/features/valorizaciones/ValorizacionesView.tsx",
  "utf8",
)
source = source
  .replace(
    /import\s*\{[^}]*\buseAppStore\b[^}]*\}\s*from\s*["'][^"']+["'];?/,
    "const useAppStore=()=>({state:fixtureStore,refreshRemoteData:async()=>{}});",
  )
  .replace(
    /import\s*\{[^}]*\buseUserProfile\b[^}]*\}\s*from\s*["'][^"']+["'];?/,
    "const useUserProfile=()=>({profile:{id:'analista'}});",
  )
  .replace(
    /import\s*\{[^}]*\bactualizarPerfil\b[^}]*\}\s*from\s*["'][^"']+["'];?/,
    "const actualizarPerfil=async()=>{};const obtenerPerfiles=async()=>[];type Perfil={id:string;estado:string;rol:string;nombre:string;email:string};",
  )
  .replace(
    /import\s*\{[^}]*\bcompressPhoto\b[^}]*\}\s*from\s*["'][^"']+["'];?/,
    `const loadValuations=async()=>fixtureRows;const loadValuationDetails=async()=>({documents:[],events:[]});const operateValuation=async()=>{};const uploadEvidence=async()=>{};const compressPhoto=async(f:File)=>f;const documentUrl=async()=>'';`,
  )
  .replace(/(["'])\.\.\/\.\.\/utils\/limaDate\1/, '"/src/utils/limaDate"')
  .replace(/(["'])\.\/domain\1/, '"/src/features/valorizaciones/domain"')
  .replace(
    /(["'])\.\/valorizaciones\.css\1/,
    '"/src/features/valorizaciones/valorizaciones.css"',
  )
  .replace(/(["'])\.\/pdf\1/g, '"/src/features/valorizaciones/pdf"')
const fixture = `
const fixtureStore={cotizaciones:[{id:'cotizacion',proyecto_id:'proyecto',serie_id:'serie',estado:'ACEPTADA',creado_por:'analista',codigo:'COT-P-000031',importe_aceptado:4800,proyecto_snapshot:{nombre:'Instalación comercio Piura'},presupuesto:{moneda:'PEN',tecnico:'Técnico responsable',gastos:[{rubro:'MANO_OBRA',cantidad:1,costoUnitario:550},{rubro:'HABILITACION',cantidad:1,costoUnitario:200}]}}],proyectos:[{id:'proyecto',nombre:'Instalación comercio Piura'}],gastosProyecto:[],materials:[{id:'TUB',nombre:'Tubería PEALPE',precioUnitario:10}]};
const base={cotizacion_id:'cotizacion',proyecto_id:'proyecto',serie_id:'serie',analista_id:'analista',tecnico:'Técnico responsable',dni:'12345678',etapa:'INTERNA',tipo:'FINAL',monto:550,adelantos:100,neto:425,descuentos:[{sku:'TUB',nombre:'Tubería PEALPE',cantidad:2,referencia:10,monto:25,motivo:'Sobrante no devuelto'}],checklist:{},motivo:'',observacion:'',revision:1,created_at:'2026-10-14T15:00:00Z'};
const fixtureRows=[{...base,id:'uno',codigo:'VAL-000001',estado:'EN_TESORERIA'},{...base,id:'dos',codigo:'VAL-000002',estado:'AUTORIZADA',etapa:'HABILITACION',monto:200,adelantos:0,neto:200,descuentos:[]},{...base,id:'tres',codigo:'VAL-000003',estado:'RETENIDA',observacion:'Completar evidencias de resane'}];
`
writeFileSync(
  `${folder}/preview.tsx`,
  `${source}\n${fixture}\nimport {createRoot} from 'react-dom/client';\nconst role=new URLSearchParams(location.search).get('rol') ?? 'tesoreria';createRoot(document.getElementById('root')!).render(<ValorizacionesView role={role as Role} onToast={()=>{}}/>);`,
)
writeFileSync(
  `${folder}/index.html`,
  `<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prueba aislada de valorizaciones</title><link rel="stylesheet" href="/src/index.css"></head><body style="background:#f4f4f5"><div id="root"></div><script type="module" src="/test-results/valorizaciones/preview.tsx?qa=${Date.now()}"></script></body></html>`,
)
console.log(
  "Vista aislada: http://localhost:8443/test-results/valorizaciones/index.html",
)
