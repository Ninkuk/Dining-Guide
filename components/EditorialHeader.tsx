type EditorialHeaderProps = {
  visited: number;
  cities: number;
  cuisines: number;
};

export function EditorialHeader({
  visited,
  cities,
  cuisines,
}: EditorialHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-border/60 pb-6">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        A dining journal
      </p>
      <h1 className="font-heading text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl">
        Places we&rsquo;ve eaten,
        <br />
        <span className="text-muted-foreground">and places we want to.</span>
      </h1>
      <p className="font-mono text-xs uppercase tracking-wider tabular-nums text-muted-foreground">
        <span className="text-foreground">{visited}</span> visited
        <span aria-hidden> · </span>
        <span className="text-foreground">{cities}</span> cities
        <span aria-hidden> · </span>
        <span className="text-foreground">{cuisines}</span> cuisines
      </p>
    </header>
  );
}
