import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Download, Loader2, User, Mail, Shield, Calendar, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, getApiError } from '@/api/client';
import { API } from '@/api/endpoints';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { DeleteAccountModal } from '@/components/DeleteAccountModal';
import { RegisterUserModal } from '@/components/RegisterUserModal';
import type { UserResponse } from '@/types/api';

function DataExportButton({ userId }: { userId: string }) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await apiClient.get(API.users.export(userId));
      const blob = new Blob(
        [JSON.stringify(response.data, null, 2)],
        { type: 'application/json' },
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dados_usuario_${userId.slice(0, 8)}_${format(new Date(), 'yyyy-MM-dd')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Dados exportados com sucesso');
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button variant="outline" onClick={handleExport} disabled={isExporting}>
      {isExporting ? (
        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Exportando...</>
      ) : (
        <><Download className="h-4 w-4 mr-2" />Exportar meus dados</>
      )}
    </Button>
  );
}

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  seller: 'Vendedor',
  buyer: 'Comprador',
};

export default function Account() {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const { data: user, isLoading, isError } = useQuery<UserResponse>({
    queryKey: ['users', 'me'],
    queryFn: () => apiClient.get(API.users.me).then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !user) {
    return (
      <div className="p-6">
        <p className="text-destructive">Não foi possível carregar os dados do usuário.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Minha Conta</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie suas informações e dados pessoais.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informações do usuário</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 text-sm">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground w-24 shrink-0">Nome</span>
            <span className="font-medium">{user.name}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground w-24 shrink-0">E-mail</span>
            <span className="font-medium">{user.email}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground w-24 shrink-0">Perfil</span>
            <span className="font-medium">{roleLabels[user.role] ?? user.role}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground w-24 shrink-0">Membro desde</span>
            <span className="font-medium">{format(new Date(user.created_at), 'dd/MM/yyyy')}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Privacidade e dados (LGPD)</CardTitle>
          <CardDescription>
            Você pode baixar uma cópia de todos os seus dados armazenados no sistema,
            conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Separator className="mb-4" />
          <DataExportButton userId={user.id} />
          <p className="text-xs text-muted-foreground mt-3">
            O arquivo JSON inclui seus dados cadastrais e o histórico de ações realizadas no sistema.
          </p>
        </CardContent>
      </Card>
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setRegisterOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Cadastrar Usuário
        </Button>
        <Button
          variant="destructive"
          className="opacity-70 hover:opacity-100"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Deletar minha conta
        </Button>
      </div>

      <DeleteAccountModal open={deleteOpen} onOpenChange={setDeleteOpen} />
      <RegisterUserModal open={registerOpen} onOpenChange={setRegisterOpen} />
    </div>
  );
}
