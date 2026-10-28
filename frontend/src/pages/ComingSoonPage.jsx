import { Link } from 'react-router-dom';

export default function ComingSoonPage({ title, notFound = false }) {
  return (
    <section className="mx-auto max-w-2xl px-4 py-24 text-center">
      <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
      <p className="mt-3 text-slate-700">
        {notFound ? 'The page you are looking for does not exist.' : 'This feature will be available in a later release.'}
      </p>
      <Link to="/" className="mt-6 inline-block rounded-lg bg-green-700 px-5 py-2 font-semibold text-white hover:bg-green-800">
        Back to Home
      </Link>
    </section>
  );
}
