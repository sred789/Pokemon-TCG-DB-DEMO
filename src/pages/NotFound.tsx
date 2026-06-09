import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="card p-8 text-center">
      <h1 className="mb-2 text-2xl font-extrabold">Page not found</h1>
      <Link className="btn-primary mt-3 inline-flex" to="/">
        Back to dashboard
      </Link>
    </div>
  );
}
