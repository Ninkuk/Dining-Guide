type EditorialHeaderProps = {
  visited: number;
  cities: number;
  cuisines: number;
};

export function EditorialHeader({ visited, cities, cuisines }: EditorialHeaderProps) {
  return (
    <header className="border-border/60 flex flex-col gap-3 border-b pb-6">
      <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
        A dining journal
      </p>
      <h1 className="font-heading text-4xl leading-[1.05] font-medium tracking-tight sm:text-5xl">
        Places we&rsquo;ve eaten,
        <br />
        <span className="text-muted-foreground">and places we want to.</span>
      </h1>
      <p className="text-muted-foreground font-mono text-xs tracking-wider uppercase tabular-nums">
        <span className="text-foreground">{visited}</span> visited
        <span aria-hidden> · </span>
        <span className="text-foreground">{cities}</span> cities
        <span aria-hidden> · </span>
        <span className="text-foreground">{cuisines}</span> cuisines
      </p>
    </header>
  );
}
