import { Link } from 'react-router-dom';
import Hero from '../components/Hero.jsx';
import HowItWorks from '../components/HowItWorks.jsx';
import ConnectionStatus from '../components/ConnectionStatus.jsx';
import { CATEGORIES } from '../data/materialOptions.js';

export default function HomePage() {
  return (
    <>
      <Hero />
      <section aria-labelledby="categories-heading" className="mx-auto max-w-6xl px-4 py-14">
        <h2 id="categories-heading" className="text-3xl font-bold text-slate-900">Browse by category</h2>
        <p className="mt-2 text-slate-700">Real listings from the community. Log in to browse and share materials.</p>
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {CATEGORIES.map((category) => (
            <li key={category.value}>
              <Link
                to={`/materials?category=${category.value}`}
                className="block rounded-xl border border-green-100 bg-white px-4 py-5 text-center font-semibold text-green-900 shadow-sm hover:bg-green-50"
              >
                {category.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <HowItWorks />
      {import.meta.env.DEV && <ConnectionStatus />}
    </>
  );
}
