import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Hero() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  function handleSubmit(event) {
    event.preventDefault();
    const term = query.trim();
    navigate(term ? `/materials?search=${encodeURIComponent(term)}` : '/materials');
  }

  return (
    <section className="bg-gradient-to-b from-green-50 to-white">
      <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:py-20">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-green-800">Community material sharing</p>
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          Give Unused Materials a Second Life
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-700">
          ReUseHub connects businesses, offices, workshops, printing shops, and individuals who have
          leftover materials with people who can put them to good use — reducing waste and saving money.
        </p>

        <form role="search" onSubmit={handleSubmit} className="mx-auto mt-8 flex max-w-xl flex-col gap-2 sm:flex-row">
          <label htmlFor="material-search" className="sr-only">Search materials</label>
          <input
            id="material-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search cardboard, wood, paper…"
            className="w-full rounded-lg border border-slate-400 px-4 py-3 text-base"
          />
          <button type="submit" className="rounded-lg bg-green-700 px-6 py-3 font-semibold text-white hover:bg-green-800">Search</button>
        </form>
      </div>
    </section>
  );
}
