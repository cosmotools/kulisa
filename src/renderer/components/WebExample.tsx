// The welcome's two browser profiles (docs/ui.md, Own drawing): a customer places an order and the admin sees it.
// The character, desktop pages and transcript share WelcomeDemo.css's clock; neither starts a real browser.
import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, ChevronDownIcon, GlobeIcon, HeartIcon, LockKeyholeIcon,
  RotateCwIcon, SearchIcon, ShoppingBagIcon, StarIcon, TruckIcon, UserRoundIcon, LayoutDashboardIcon, PackageIcon, SettingsIcon } from 'lucide-react';
import { avatarSrc } from '../lib/common';

const WIDTH = 1120;
const PRODUCTS = [
  { name: 'Everyday tote', category: 'For wherever the day takes you', price: '$24', image: 'tote.jpg' },
  { name: 'Wireless headphones', category: 'A little less noise. A lot more music.', price: '$89', image: 'headphones.jpg' },
  { name: 'Daily bottle', category: 'Stay refreshed, wherever you go', price: '$32', image: 'bottle.jpg' },
];

function ProfilePreview({ name, avatar, path, summary, children }: {
  name: string; avatar: string; path: string; summary: string; children: ReactNode;
}) {
  return <div role="img" aria-label={`${name} browser profile: ${summary}`} className="min-w-0">
    <div aria-hidden="true" className={`welcome-web-${name.toLowerCase()} pointer-events-none relative overflow-hidden rounded-lg border bg-background`}>
      <div className="flex h-8 items-center gap-2 border-b bg-card px-3 text-xs">
        <img src={avatarSrc(avatar)} width={18} height={18} alt="" /><span className="font-medium">{name}</span><span className="ms-auto text-[10px] text-muted-foreground">daylight.</span>
      </div>
      <div className="flex h-8 items-center gap-2 border-b px-3 text-muted-foreground">
        <ArrowLeftIcon className="size-3" /><ArrowRightIcon className="size-3 opacity-40" /><RotateCwIcon className="size-3" />
        <div className="ms-1 flex h-5 flex-1 items-center gap-1.5 rounded-md bg-muted px-2 text-[10px]"><LockKeyholeIcon className="size-2.5" />localhost:3000/{path}</div>
        <GlobeIcon className="size-3" />
      </div>
      <div className="relative aspect-[1120/656] overflow-hidden">
        <div className="absolute top-0 left-0 h-164 w-280 origin-top-left scale-(--shop-scale) overflow-hidden bg-primary-foreground text-primary dark:bg-foreground dark:text-background">{children}</div>
      </div>
      <div className="flex min-h-8 items-center gap-1.5 border-t px-2 py-1.5 text-[11px]"><div className="relative h-4 min-w-0 flex-1">
        <span data-demo-motion className={`welcome-web-${name.toLowerCase()}-before absolute inset-0 flex items-center gap-1.5 text-warning`}><span className="size-1.5 rounded-full bg-current" />{name === 'Customer' ? 'Testing checkout…' : 'Checking the incoming order…'}</span>
        <span data-demo-motion className={`welcome-web-${name.toLowerCase()}-after absolute inset-0 flex items-center gap-1.5`}><CheckIcon className="size-3 shrink-0 text-success" />{summary}</span>
      </div></div>
      <div data-demo-motion className="welcome-web-profile-activity pointer-events-none absolute inset-0 rounded-lg border-2 border-warning" />
    </div>
  </div>;
}

function Shop() {
  return <>
    <div className="flex h-7 items-center justify-center gap-2 bg-primary text-xs tracking-wide text-primary-foreground dark:bg-background dark:text-foreground">
      <TruckIcon className="size-3.5" />Free shipping on orders over $50<span className="mx-3 opacity-40">|</span>Made for your everyday
    </div>
    <div className="flex h-18 items-center justify-between border-b border-border px-12 dark:border-muted-foreground/20">
      <div className="font-serif text-[32px] font-semibold tracking-tight">daylight<span className="text-warning">.</span></div>
      <div className="flex items-center gap-8 text-sm"><span className="font-semibold">Shop all</span><span>New arrivals</span><span>Bestsellers</span><span>Our story</span></div>
      <div className="flex items-center gap-5"><SearchIcon className="size-5" /><UserRoundIcon className="size-5" /><span className="relative"><ShoppingBagIcon className="size-5" /><span className="absolute -top-2 -right-3 grid size-4 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground dark:bg-background dark:text-foreground"><span className="relative grid"><span data-demo-motion className="welcome-web-cart-empty col-start-1 row-start-1">0</span><span data-demo-motion className="welcome-web-cart-full col-start-1 row-start-1">1</span></span></span></span></div>
    </div>
    <div className="flex h-9 items-center justify-center gap-8 border-b border-border text-xs dark:border-muted-foreground/20">
      <span>Bags & accessories</span><span>Tech essentials</span><span>Drinkware</span><span>Home & living</span><span>Gifts under $50</span>
    </div>
    <div className="h-130 overflow-hidden"><div data-demo-motion className="welcome-web-shop-scroll">
    <div className="flex h-29 items-center justify-between px-12">
      <div><p className="mb-2 text-[10px] font-medium tracking-[.18em] uppercase opacity-60">Small upgrades. Better days.</p>
        <h2 className="font-serif text-[40px] leading-none tracking-tight">Your everyday, elevated.</h2>
        <p className="mt-3 text-sm opacity-60">Thoughtful essentials. Nothing extra.</p>
      </div>
      <div className="flex items-center gap-2 text-xs">All products<ChevronDownIcon className="size-3.5" /></div>
    </div>
    <div className="grid grid-cols-3 gap-6 px-12">
      {PRODUCTS.map((product, i) => <div key={product.name} className="min-w-0">
        <div className="relative h-60 overflow-hidden rounded-sm bg-muted dark:bg-primary">
          <img src={`./welcome/${product.image}`} width={600} height={600} alt="" className="h-full w-full object-cover" />
          <span className="absolute top-3 left-3 rounded-sm bg-primary-foreground px-2 py-1 text-[10px] font-medium text-primary dark:bg-foreground dark:text-background">{i === 0 ? 'Bestseller' : i === 1 ? 'New arrival' : 'Everyday favorite'}</span>
          <span className="absolute top-3 right-3 grid size-7 place-items-center rounded-full bg-primary-foreground text-primary dark:bg-foreground dark:text-background"><HeartIcon className="size-3.5" /></span>
        </div>
        <div className="mt-3 flex justify-between gap-3 text-sm font-medium"><span>{product.name}</span><span>{product.price}</span></div>
        <p className="mt-1 text-xs opacity-60">{product.category}</p>
        {i === 0 && <div className="mt-2 flex items-center gap-2 text-[10px]"><span data-demo-motion className="welcome-web-option rounded-sm border border-border px-2 py-1 dark:border-muted-foreground/30">Natural</span><span className="opacity-50">Black</span></div>}
        <div className="mt-2 flex items-center gap-1"><span className="flex gap-0.5">{Array.from({ length: 5 }, (_, n) => <StarIcon key={n} className="size-2.5 fill-current" />)}</span><span className="ms-1 text-[10px] opacity-50">{[128, 86, 214][i]} reviews</span></div>
        <div data-demo-motion={i === 0 ? true : undefined} className={i === 0 ? 'welcome-web-add relative mt-3 flex h-8 items-center justify-center gap-2 rounded-sm bg-primary text-xs font-medium text-primary-foreground dark:bg-background dark:text-foreground'
          : 'mt-3 flex h-8 items-center justify-center gap-2 rounded-sm border border-border text-xs dark:border-muted-foreground/30'}>
          <ShoppingBagIcon className="size-3.5" />Add to bag
        </div>
      </div>)}
    </div>
    <div className="mx-12 mt-5 flex items-center justify-center gap-8 border-t border-border pt-3 text-[10px] opacity-60 dark:border-muted-foreground/20"><span>Free shipping over $50</span><span>30-day returns</span><span>Made to last</span></div>
    </div></div>
    <div data-demo-motion className="welcome-web-cart absolute top-18 right-5 z-10 w-96 rounded-lg border border-border bg-primary-foreground p-6 shadow-xl dark:border-muted-foreground/30 dark:bg-foreground">
      <p className="mb-5 text-2xl font-semibold">Your bag <span className="opacity-40">(1)</span></p>
      <div className="flex items-center gap-4"><img src="./welcome/tote.jpg" width={80} height={80} alt="" className="size-20 rounded object-cover" /><div><p className="font-medium">Everyday tote</p><p className="mt-1 text-sm opacity-50">Natural · Qty 1</p></div><span className="ms-auto font-medium">$24</span></div>
      <div className="mt-6 flex justify-between border-t border-border pt-4 font-semibold dark:border-muted-foreground/20"><span>Total</span><span>$24</span></div>
      <div data-demo-motion className="welcome-web-checkout mt-5 flex h-12 items-center justify-center rounded bg-primary font-medium text-primary-foreground dark:bg-background dark:text-foreground">Place order</div>
      <p className="mt-3 text-center text-xs opacity-50">Free returns within 30 days</p>
    </div>
    <div data-demo-motion className="welcome-web-confirmation absolute top-38 right-12 flex items-center gap-3 rounded-md border border-success/40 bg-primary-foreground px-4 py-3 shadow-md dark:bg-foreground">
      <CheckIcon className="size-6 text-success" /><div><p className="text-sm font-semibold">Order #1042 confirmed</p><p className="mt-1 text-xs opacity-60">Everyday tote · $24</p></div>
    </div>
  </>;
}

function Orders() {
  return <div className="flex h-full">
    <div className="flex w-48 shrink-0 flex-col border-r border-border px-5 py-7 dark:border-muted-foreground/20">
      <div className="font-serif text-2xl font-semibold tracking-tight">daylight<span className="text-warning">.</span></div>
      <p className="mt-1 text-xs opacity-50">Store administration</p>
      <div className="mt-10 flex flex-col gap-2 text-sm">
        <div className="flex items-center gap-3 px-3 py-3 opacity-60"><LayoutDashboardIcon className="size-4" />Overview</div>
        <div className="flex items-center gap-3 rounded-md bg-primary px-3 py-3 font-medium text-primary-foreground dark:bg-background dark:text-foreground"><ShoppingBagIcon className="size-4" />Orders<span className="ms-auto text-xs"><OrderCount before="51" after="52" /></span></div>
        <div className="flex items-center gap-3 px-3 py-3 opacity-60"><PackageIcon className="size-4" />Products</div>
        <div className="flex items-center gap-3 px-3 py-3 opacity-60"><UserRoundIcon className="size-4" />Customers</div>
      </div>
      <div className="mt-auto flex items-center gap-3 px-3 text-sm opacity-60"><SettingsIcon className="size-4" />Settings</div>
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex h-18 items-center justify-between border-b border-border px-9 text-xs dark:border-muted-foreground/20"><span className="opacity-50">Store / Orders</span><span className="flex items-center gap-2"><UserRoundIcon className="size-4" />Admin</span></div>
      <div className="px-9 py-7">
        <div className="mb-7 flex items-center justify-between"><div><h2 className="text-4xl font-semibold tracking-tight">Orders</h2><p className="mt-2 text-sm opacity-50">Manage purchases from your online store.</p></div><span className="rounded-md border border-border px-4 py-2 text-xs dark:border-muted-foreground/30">Export orders</span></div>
        <div className="mb-8 grid grid-cols-3 gap-4">
          {[{ label: 'Total orders', before: '51', after: '52' }, { label: 'Revenue', before: '$1,224', after: '$1,248' }, { label: 'To fulfill', before: '7', after: '8' }].map(({ label, before, after }) => <div key={label} className="rounded-lg border border-border p-4 dark:border-muted-foreground/20"><p className="text-xs opacity-50">{label}</p><p className="mt-2 text-3xl font-semibold"><OrderCount before={before} after={after} /></p></div>)}
        </div>
        <div className="mb-4 flex items-center justify-between"><p className="text-lg font-semibold">Recent orders</p><span className="flex items-center gap-2 text-xs opacity-50"><SearchIcon className="size-3.5" />Search orders</span></div>
        <div className="overflow-hidden rounded-lg border border-border dark:border-muted-foreground/20">
          <div className="grid grid-cols-[1fr_2.1fr_1fr_1fr] gap-3 border-b border-border bg-muted px-4 py-3 text-xs opacity-60 dark:border-muted-foreground/20 dark:bg-primary"><span>Order</span><span>Product</span><span>Payment</span><span className="text-right">Total</span></div>
          {[
            { id: 1042, image: 'tote.jpg', product: 'Everyday tote', price: '$24', time: 'Just now' },
            { id: 1041, image: 'headphones.jpg', product: 'Wireless headphones', price: '$89', time: '4 min ago' },
            { id: 1040, image: 'bottle.jpg', product: 'Daily bottle', price: '$32', time: '12 min ago' },
          ].map((order, i) => <div key={order.id} data-demo-motion={i === 0 ? true : undefined} className={i === 0 ? 'welcome-web-new-order' : undefined}><div className={i === 0 ? 'grid grid-cols-[1fr_2.1fr_1fr_1fr] items-center gap-3 border-b border-success/30 bg-success/10 px-4 py-4' : 'grid grid-cols-[1fr_2.1fr_1fr_1fr] items-center gap-3 border-b border-border px-4 py-4 last:border-0 dark:border-muted-foreground/20'}>
            <div><p className="text-sm font-semibold">#{order.id}</p><p className="mt-1 text-[10px] opacity-50">{order.time}</p></div>
            <div className="flex items-center gap-3"><img src={`./welcome/${order.image}`} width={38} height={38} alt="" className="size-10 rounded-sm object-cover" /><span className="text-xs">{order.product}</span></div>
            <span className="flex items-center gap-1 text-xs"><CheckIcon className="size-3 text-success" />Paid</span><span className="text-right text-sm font-medium">{order.price}</span>
          </div></div>)}
        </div>
        <p className="mt-4 flex items-center gap-2 text-xs opacity-50"><RotateCwIcon className="size-3" />Up to date · New orders appear automatically</p>
      </div>
    </div>
    <div data-demo-motion className="welcome-web-order-detail absolute top-18 right-0 bottom-0 z-10 w-96 border-l border-border bg-primary-foreground p-7 shadow-xl dark:border-muted-foreground/30 dark:bg-foreground">
      <p className="text-xs opacity-50">Order details</p><h3 className="mt-3 text-3xl font-semibold">#1042</h3>
      <p className="mt-4 flex items-center gap-2 text-sm text-success"><CheckIcon className="size-4" />Payment received</p>
      <div className="mt-7 flex items-center gap-4 border-y border-border py-5 dark:border-muted-foreground/20"><img src="./welcome/tote.jpg" width={72} height={72} alt="" className="size-18 rounded object-cover" /><div><p className="text-sm font-medium">Everyday tote</p><p className="mt-2 text-xs opacity-50">Natural · Qty 1</p></div></div>
      <div className="mt-6 flex justify-between font-semibold"><span>Total paid</span><span>$24</span></div>
      <div data-demo-motion className="welcome-web-verified mt-8 flex items-center gap-2 rounded-md border border-success/30 bg-success/10 p-3 text-sm"><CheckIcon className="size-4 text-success" />Matches the customer’s order</div>
    </div>
  </div>;
}

function OrderCount({ before, after }: { before: string; after: string }) {
  return <span className="inline-grid">
    <span data-demo-motion className="welcome-web-metric-before col-start-1 row-start-1">{before}</span>
    <span data-demo-motion className="welcome-web-metric-after col-start-1 row-start-1">{after}</span>
  </span>;
}

// A curtain-shaped body and two feet give Kulisa its own character without borrowing an agent's brand.
function DemoAgent({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className={className}>
    <path d="M14 35 12 42M34 35l2 7" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    <path d="M8 13Q24 3 40 13V35Q35 31 30 35Q24 31 18 35Q13 31 8 35Z" fill="currentColor" />
    <path d="M12 13Q24 6 36 13" stroke="var(--primary-foreground)" strokeOpacity=".25" strokeWidth="2" strokeLinecap="round" />
    <rect x="15" y="17" width="18" height="11" rx="5.5" fill="var(--background)" />
    <g data-demo-motion className="welcome-agent-eyes" fill="var(--foreground)"><rect x="19" y="20" width="3" height="5" rx="1.5" /><rect x="26" y="20" width="3" height="5" rx="1.5" /></g>
    <path d="m7 23-4 3m38-3 4 3" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>;
}

export function WebExample() {
  const scene = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scene.current;
    if (!el) return;
    // The same measured width positions the unscaled character and scales both desktop pages.
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const width = Math.max(0, (entry.contentRect.width - 12) / 2 - 2);
      el.style.setProperty('--page-width', `${width}px`);
      el.style.setProperty('--shop-scale', String(width / WIDTH));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return <div ref={scene} className="relative grid grid-cols-2 gap-3 p-3 [--page-width:0px] [--shop-scale:0]">
    <ProfilePreview name="Customer" avatar="fox" path="shop" summary="Order #1042 placed · $24"><Shop /></ProfilePreview>
    <ProfilePreview name="Admin" avatar="owl" path="admin/orders" summary="Order #1042 verified · $24"><Orders /></ProfilePreview>
    <div aria-hidden="true" data-demo-motion className="welcome-agent pointer-events-none absolute top-19.25 left-3.25 z-30">
      <span data-demo-motion className="welcome-agent-click absolute -top-3 -left-3 size-7 rounded-full border-2 border-destructive" />
      <div className="welcome-agent-character -translate-x-3 -translate-y-9 text-destructive drop-shadow-md"><DemoAgent className="size-10" /><span className="absolute top-8 left-9 rounded-md bg-destructive px-1.5 py-0.5 text-[9px] font-medium text-primary-foreground">Agent</span></div>
    </div>
  </div>;
}
