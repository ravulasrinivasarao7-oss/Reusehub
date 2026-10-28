const STEPS = [
  { title: 'List your materials', text: 'Describe the leftover materials you no longer need, including quantity, condition, and location.' },
  { title: 'Discover what you need', text: 'Search and filter listings to find materials that fit your project or business.' },
  { title: 'Request and collect', text: 'Send a request to the owner, agree on pickup, and give those materials a second life.' },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-heading" className="bg-green-50">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <h2 id="how-heading" className="text-center text-3xl font-bold text-slate-900">How It Works</h2>
        <ol className="mt-8 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-xl bg-white p-6 shadow-sm">
              <span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-full bg-green-700 font-bold text-white">
                {index + 1}
              </span>
              <h3 className="mt-4 text-lg font-bold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-slate-700">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
