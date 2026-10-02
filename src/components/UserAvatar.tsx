import { useState } from 'react';
export default function UserAvatar({ name, src }: { name: string; src?: string | null }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (src && src !== failedSource) return <img className="user-avatar-image" src={src} alt={`Foto de ${name}`} onError={() => setFailedSource(src)} />;
  return <span aria-hidden="true">{name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase() || 'U'}</span>;
}
