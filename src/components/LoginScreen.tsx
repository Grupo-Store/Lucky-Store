import { useState } from 'react';
import { useAuth } from '@/store/AuthStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import logo from '@/assets/logo.png';

export function LoginScreen() {
  const { login } = useAuth();
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!login(user, pass)) setError('Please enter user and password');
    else setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary">
      <Card className="w-full max-w-md shadow-2xl">
        <CardContent className="pt-8 pb-8 px-8">
          <div className="flex justify-center mb-8">
            <img src={logo} alt="Lucky Store Informática" className="h-20 object-contain" />
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              placeholder="Usuário"
              value={user}
              onChange={e => setUser(e.target.value)}
              className="bg-card"
            />
            <Input
              type="password"
              placeholder="Senha"
              value={pass}
              onChange={e => setPass(e.target.value)}
              className="bg-card"
            />
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button type="submit" className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground">
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
