/**
 * Sinal de vida sem nenhuma importação.
 *
 * Existe para separar duas causas que produzem a mesma tela de "esta função
 * quebrou": um erro no NOSSO código (banco, migrações, dependências) e um erro
 * na forma como a plataforma constrói e executa a função.
 *
 * Se este endereço responde e os outros não, o problema está no que eles
 * importam. Se nem este responde, o problema é anterior ao código — é a
 * construção da função.
 */
export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.status(200).json({
    vivo: true,
    node: process.version,
    regiao: process.env.VERCEL_REGION ?? 'desconhecida',
    databaseUrlDefinida: Boolean(process.env.DATABASE_URL),
  })
}
