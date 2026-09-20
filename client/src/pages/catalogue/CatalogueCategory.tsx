import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function CatalogueCategory() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    navigate(`/catalogue?category=${slug}`, { replace: true });
  }, [slug]);

  return null;
}
