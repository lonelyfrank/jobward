# Sidebar: comportamento derivato da Sensei

Riferimenti analizzati: [Sidebar.jsx](https://github.com/lonelyfrank/sensei-learning/blob/f9522c9ca6a59ad55f86ee34127745090d8d6c3a/src/components/Sidebar.jsx),
[NavItem.jsx](https://github.com/lonelyfrank/sensei-learning/blob/f9522c9ca6a59ad55f86ee34127745090d8d6c3a/src/components/NavItem.jsx)
e [App.jsx](https://github.com/lonelyfrank/sensei-learning/blob/f9522c9ca6a59ad55f86ee34127745090d8d6c3a/src/App.jsx).

## Schema di Sensei

- Lo stato `collapsed` appartiene alla shell e scende alla sidebar via props.
- La larghezza passa tra 220 e 52 px in 200 ms. Le icone restano nella stessa posizione orizzontale.
- Le etichette sfumano in 100 ms e riducono la larghezza in 220 ms; in apertura riappaiono durante l'espansione.
- `contentCollapsed`, ritardato di 210 ms in chiusura, governa le sezioni secondarie: griglia da `1fr` a `0fr`, con overflow nascosto. Il profilo resta in fondo e l'avatar ha un piccolo rimbalzo a chiusura completata.
- Il bulge usa due curve di Bézier: sporgenza massima 18 px, semialtezza 65 px. Si attiva entro 40 px dal bordo, a partire da 10 px all'interno della sidebar. La sporgenza diminuisce con la distanza.
- Un ciclo `requestAnimationFrame` interpola posizione verticale e sporgenza con fattore 0,10. In Sensei la coordinata orizzontale interpola anche la larghezza con fattore 0,28.
- Il cerchio con chevron segue il bulge e alterna collapse/expand. Le icone compresse mostrano tooltip.

## Adattamento in Jobward

`AppShell` continua a gestire lo stato con `useSidebarCollapsed`, incluso il salvataggio in localStorage e la migrazione della chiave precedente.
`Sidebar` gestisce etichette e sezioni secondarie, con il menu account fissato in fondo e la voce Impostazioni al suo interno; `SidebarBulge` gestisce la curva e il pulsante desktop.

La sidebar desktop passa da 220 px aderenti al lato a 60 px fluttuanti, con 12 px di margine a sinistra, sopra e sotto, angoli da 20 px, senza ombra o sfocatura del contenuto sottostante. Barra, link, pulsante account e margini compatti usano tutti unità relative al carattere di base: la barra misura 3,75 rem e i controlli 2,75 × 2,75 rem, con 0,5 rem di margine laterale (60 px, 44 × 44 px e 8 px con base 16 px). Il riquadro attivo mantiene così il rapporto 1:1 anche con caratteri ingranditi; icone e marchio sono centrati. Larghezza, margini, angoli, altezza della testata e spazi fra le icone cambiano insieme in 300 ms. Le icone passano da un allineamento all’altro tramite il padding, senza salti di `justify-content`. Le etichette riappaiono dopo 80 ms e sfumano in 150 ms; il marchio completo usa i PNG originali, con la variante chiara per il tema scuro. Al collapse il logo completo sfuma nel simbolo compatto, ritagliato dagli stessi pixel originali e centrato nella sidebar; non viene ricreata alcuna scritta come testo. Il menu account resta montato, con avatar stabile e altezza e testo animati; le sezioni secondarie si aprono e si chiudono nella stessa transizione, senza timer. In apertura la sidebar torna aderente al lato.

La curva è ancorata al bordo reale della sidebar: segue direttamente la transizione CSS della larghezza e dei margini senza un secondo inseguimento orizzontale.
Non c'è l'offset fisso di 40 px usato dalla titlebar Electron di Sensei. Le coordinate provengono dal contenitore di Jobward.
Il fattore di interpolazione è adattato al tempo fra frame e il ciclo si ferma quando la curva raggiunge il target.

Il controllo è un pulsante HTML con nome accessibile e `aria-expanded`: compare anche al focus da tastiera e risponde a Invio/Spazio.
Quando è invisibile non intercetta il puntatore. Le sezioni secondarie compresse sono `inert`; i link principali mantengono i nomi accessibili e tooltip Radix.
Con `prefers-reduced-motion` la curva si aggiorna senza interpolazione e le transizioni CSS sono disattivate.
Colori, marchio e dati restano quelli di Jobward. Sotto 768 px resta il drawer mobile, aperto dal menu della topbar e indipendente dallo stato desktop.

La transizione fluttuante a 300 ms è l'eccezione richiesta al limite generale di 180 ms del design system, per accompagnare il passaggio fra sidebar aderente ed espansa e sidebar compatta fluttuante.

Verifica browser: `apps/web/e2e/sidebar.spec.ts` copre prossimità, inseguimento, scomparsa, toggle, persistenza, tooltip, tastiera, axe nei due temi, movimento ridotto e drawer mobile.
