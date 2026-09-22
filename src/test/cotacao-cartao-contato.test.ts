import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const fonte = readFileSync(
  resolve(__dirname, '..', 'components/QuoteModal.tsx'), 'utf-8',
);

describe('cartão de contato do rodapé', () => {
  it('a primeira linha é o nome de quem assinou', () => {
    expect(fonte).toContain('<div className="qp-fcard-nome">{sellerName}</div>');
  });

  it('não mostra o CNPJ dentro do cartão', () => {
    expect(fonte).not.toContain('qp-fcard-cnpj');
  });

  it('telefone e e-mail continuam embaixo, na mesma ordem', () => {
    expect(fonte).toMatch(
      /qp-fcard-nome">\{sellerName\}<\/div>\s*\n\s*\{vendedor\?\.phone &&[^\n]*\n\s*\{vendedor\?\.email &&/
    );
  });

  it('cada linha só aparece se estiver preenchida', () => {
    // Vendedor sem telefone cadastrado nao deixa uma linha vazia no cartao.
    expect(fonte).toContain('{vendedor?.phone && <div className="qp-fcard-linha">{vendedor.phone}</div>}');
    expect(fonte).toContain('{vendedor?.email && <div className="qp-fcard-linha">e-mail: {vendedor.email}</div>}');
  });

  it('o nome mantém a tipografia do cartão', () => {
    // A classe carregava font-weight:700 de quando mostrava o nome do vendedor.
    expect(fonte).toContain('.qp-fcard-nome{font-size:12.5px;font-weight:400;');
    expect(fonte).not.toContain('.qp-fcard-cnpj{');
  });

  it('a faixa azul continua a mesma', () => {
    expect(fonte).toContain('<div className="qp-fcard-bar">Vendas, Locações e Serviços</div>');
  });
});

describe('a linha de texto do rodapé', () => {
  it('mostra o CNPJ junto do endereço', () => {
    expect(fonte).toContain('CNPJ {store.rodape.cnpj} · {store.rodape.endereco}');
  });

  it('mantém endereço e CEP', () => {
    expect(fonte).toContain('<p className="qp-footer-text">CNPJ {store.rodape.cnpj} · {store.rodape.endereco}</p>');
    expect(fonte).toContain('CEP: 52030-172');
  });

  it('não repete telefone nem e-mail, que já estão no cartão', () => {
    // O cartão logo acima traz os dois, e lá são os do VENDEDOR que assinou.
    // Repetir um telefone fixo e um e-mail genérico embaixo dava ao cliente
    // dois contatos para o mesmo documento, sem dizer para qual ligar.
    expect(fonte).not.toContain('e-mail: ${store.rodape.email}');
    expect(fonte).not.toContain('Fone/Fax');
  });
});

describe('o nome do vendedor não se perde do documento', () => {
  it('fica no cartão, sem campo de assinatura', () => {
    expect(fonte).toContain('<div className="qp-fcard-nome">{sellerName}</div>');
    expect(fonte).not.toContain('className="qp-sign"');
  });
});
