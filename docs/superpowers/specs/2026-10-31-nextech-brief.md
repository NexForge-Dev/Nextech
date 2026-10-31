# NEXTECH — Original brief (verbatim from the owner, PT-BR)

> This is the owner's original requirements brief, kept verbatim. The design document
> `2026-10-31-nextech-design.md` records the decisions made on top of it and wins where they differ.

# NEXTECH — Marketplace Minimalista de Produtos Afiliados

## 1. VISÃO E OBJETIVO DO PROJETO

Desenvolva uma aplicação web completa chamada **NEXTECH**, uma loja virtual de descoberta, recomendação e divulgação de produtos, utilizando o modelo de negócio de marketing de afiliados.

A NEXTECH será uma plataforma onde os consumidores poderão descobrir produtos, pesquisar diferentes categorias, visualizar informações, comparar ofertas e acessar lojas parceiras para realizar suas compras.

A plataforma não será responsável pela comercialização direta dos produtos nesta primeira versão. Sua monetização acontecerá por meio de comissões geradas a partir de links de afiliados.

O principal objetivo é criar uma experiência de compra agradável, confiável, moderna e extremamente simples de utilizar.

A NEXTECH deve parecer uma verdadeira loja virtual profissional, e não um simples catálogo de links.

**Referências de experiência:**
- Apple Store: minimalismo, elegância e organização visual.
- Mercado Livre: organização de categorias, navegação e descoberta de produtos.
- Amazon: estrutura de catálogo, pesquisa e apresentação de informações.
- Lojas modernas de tecnologia: simplicidade, clareza e foco nos produtos.

Utilize essas referências apenas como inspiração. A NEXTECH precisa ter personalidade visual própria.

---

# 2. IDENTIDADE VISUAL — PRETO E BRANCO

Esta é uma das diretrizes mais importantes do projeto.

A identidade visual da NEXTECH deverá ser construída exclusivamente em uma paleta monocromática, utilizando preto, branco e tons de cinza.

**Não utilizar azul, verde, vermelho, roxo, laranja ou outras cores como cores de destaque da interface.**

### Paleta visual

- Preto: #000000.
- Branco: #FFFFFF.
- Cinza escuro: #222222.
- Cinza intermediário: #777777.
- Cinza claro: #E5E5E5.
- Fundo secundário: #F7F7F7.

O preto deverá ser utilizado para elementos de destaque, títulos, textos importantes e botões principais.

O branco será predominante nos ambientes da loja.

Os tons de cinza deverão ser utilizados para divisórias, bordas, textos secundários, fundos de elementos e informações complementares.

### Direção de design

O design deve seguir os seguintes princípios:

- Minimalista.
- Elegante.
- Premium.
- Limpo.
- Funcional.
- Intuitivo.
- Moderno.
- Consistente.

Evitar:
- Excesso de informações na tela.
- Muitos banners.
- Gradientes coloridos.
- Sombras exageradas.
- Cards desnecessariamente grandes.
- Bordas muito pesadas.
- Animações excessivas.
- Elementos decorativos sem função.
- Interfaces com aparência de templates genéricos.

### Tipografia

Utilizar uma tipografia moderna, simples e altamente legível.

Priorizar fontes como Inter, Geist ou similares.

Criar uma hierarquia tipográfica consistente:

- Títulos grandes, com destaque.
- Subtítulos menores.
- Textos de descrição confortáveis de ler.
- Informações secundárias em cinza.
- Preços com boa visibilidade.

### Botões

Os botões devem ser simples, com aparência sofisticada.

Utilizar:
- Fundo preto e texto branco para ações principais.
- Fundo branco e texto preto para ações secundárias.
- Bordas discretas.
- Cantos levemente arredondados.
- Transições suaves ao passar o mouse.

A interface deverá manter a mesma identidade visual tanto na loja quanto no painel administrativo.

---

# 3. ESTRUTURA GERAL DA APLICAÇÃO

A NEXTECH deverá possuir dois ambientes completamente integrados:

**AMBIENTE 1 — NEXTECH STORE**

A loja pública, acessada pelos consumidores.

**AMBIENTE 2 — NEXTECH ADMIN**

O painel administrativo privado, utilizado pelo proprietário e pela equipe para controlar toda a operação da loja.

Os dois ambientes deverão compartilhar o mesmo banco de dados e utilizar permissões independentes.

Criar rotas organizadas:

- / — Página inicial.
- /produtos — Catálogo.
- /produto/[slug] — Detalhes do produto.
- /categoria/[slug] — Produtos por categoria.
- /ofertas — Ofertas disponíveis.
- /favoritos — Produtos favoritos.
- /minha-conta — Área do consumidor.
- /sobre — Sobre a NEXTECH.
- /como-funciona — Funcionamento da plataforma.
- /admin — Painel administrativo.
- /admin/produtos — Gestão de produtos.
- /admin/categorias — Gestão de categorias.
- /admin/afiliados — Gestão de afiliados.
- /admin/ofertas — Gestão de ofertas.
- /admin/banners — Gestão de banners.
- /admin/analytics — Relatórios.
- /admin/configuracoes — Configurações gerais.

---

# 4. NEXTECH STORE — LOJA PÚBLICA

## 4.1. Cabeçalho principal

Criar um header minimalista, elegante e funcional.

Elementos:

- Logotipo NEXTECH.
- Campo de pesquisa.
- Categorias.
- Ofertas.
- Favoritos.
- Minha conta.

O logotipo deverá utilizar uma tipografia forte, moderna e minimalista.

O cabeçalho deve ter fundo branco, texto preto e uma divisória cinza muito discreta na parte inferior.

O campo de pesquisa deverá ser integrado visualmente ao header, com um ícone de lupa minimalista.

No desktop, utilizar navegação horizontal.

No mobile, adaptar a estrutura para uma experiência simples, com menu compacto e pesquisa de fácil acesso.

## 4.2. Página inicial

A página inicial precisa ser organizada, comercialmente atrativa e visualmente limpa.

Não sobrecarregar o usuário com muitas seções.

Estrutura sugerida:

### Hero principal

Criar uma área inicial minimalista com uma mensagem forte.

Exemplo:

**"Encontre o que você procura. Descubra o que realmente vale a pena."**

Subtítulo:

"Uma seleção de produtos, marcas e oportunidades em um só lugar."

Adicionar um botão:

"Explorar produtos"

O hero deverá ter tipografia expressiva, bastante espaço em branco e uma composição visual elegante.

Pode utilizar uma imagem de produto em destaque, desde que não prejudique o minimalismo.

### Categorias principais

Criar uma seção com categorias organizadas horizontalmente ou em uma grade minimalista.

Categorias iniciais:

- Eletrônicos.
- Informática.
- Smartphones.
- Casa e decoração.
- Eletrodomésticos.
- Moda.
- Beleza.
- Esportes.
- Games.
- Acessórios.
- Ofertas.

Utilizar ícones monocromáticos e nomes curtos.

### Produtos em destaque

Criar uma seção chamada "Seleção NEXTECH".

Exibir produtos selecionados pelo administrador.

Cada produto deverá ser apresentado em um card com:

- Imagem.
- Nome.
- Marca.
- Preço atual.
- Preço anterior, quando houver informação confiável.
- Desconto, quando comprovado.
- Avaliação, quando disponível.
- Botão para visualizar.

Os cards deverão possuir dimensões consistentes e imagens bem alinhadas.

### Ofertas

Criar uma seção chamada "Ofertas em destaque".

Apresentar somente ofertas cadastradas e verificadas.

### Mais populares

Criar uma seção com os produtos que possuem maior interesse, considerando visualizações e cliques reais.

### Descubra por categoria

Criar uma seção visualmente organizada com acesso às principais categorias.

### Footer

Criar um rodapé simples contendo:

- Logotipo NEXTECH.
- Sobre.
- Como funciona.
- Contato.
- Política de privacidade.
- Termos de uso.
- Política de cookies.
- Aviso sobre links afiliados.

---

# 5. CATÁLOGO E PESQUISA

Criar um catálogo completo de produtos.

A página deverá permitir:

- Navegar por todos os produtos.
- Pesquisar por nome.
- Pesquisar por marca.
- Pesquisar por categoria.
- Filtrar por preço.
- Filtrar por avaliação, quando disponível.
- Ordenar por menor preço.
- Ordenar por maior preço.
- Ordenar por popularidade.
- Ordenar por produtos recentes.
- Ordenar por maior desconto comprovado.

A pesquisa deverá possuir sugestões automáticas.

Criar estados visuais para:

- Carregamento.
- Nenhum resultado.
- Erro.
- Resultados encontrados.

A navegação deverá ser rápida e intuitiva.

---

# 6. PÁGINA INDIVIDUAL DO PRODUTO

Cada produto deverá possuir uma página própria.

A estrutura deverá apresentar:

### Galeria

- Imagem principal.
- Imagens secundárias.
- Possibilidade de ampliar imagens.
- Navegação entre imagens.

### Informações

- Nome do produto.
- Marca.
- Categoria.
- Descrição.
- Avaliação, se disponível.
- Quantidade de avaliações, se disponível.
- Preço atual.
- Preço anterior, quando comprovado.
- Percentual de desconto, quando aplicável.
- Características técnicas.
- Informações da loja parceira.
- Data da última atualização do preço.

### Ação de compra

Criar um botão principal:

**"VER PRODUTO NA LOJA"**

O botão deverá direcionar o consumidor para a loja parceira através de seu link de afiliado.

Implementar redirecionamento rastreável através de:

/go/[productId]

O sistema deverá:

1. Identificar o produto.
2. Identificar o link de afiliado.
3. Registrar o evento de clique.
4. Armazenar a data e o horário.
5. Registrar a origem da navegação, quando permitido.
6. Redirecionar para a loja parceira.

A rota deverá validar o destino e impedir redirecionamentos arbitrários para URLs externas não autorizadas.

### Aviso de transparência

Apresentar discretamente:

"A NEXTECH pode receber uma comissão pelas compras realizadas através dos nossos links de afiliados, sem custo adicional para você."

Essa informação deverá estar acessível ao consumidor.

### Produtos relacionados

Adicionar uma seção de produtos similares ou relacionados.

---

# 7. FAVORITOS E ÁREA DO CONSUMIDOR

Criar um sistema simples de favoritos.

O usuário deverá conseguir:

- Adicionar um produto aos favoritos.
- Remover dos favoritos.
- Visualizar seus produtos salvos.
- Acessar novamente os produtos.

Implementar autenticação com:

- Cadastro.
- Login.
- Recuperação de senha.
- Logout.

Criar uma área denominada "Minha NEXTECH".

Ela deverá conter:

- Informações da conta.
- Favoritos.
- Histórico de navegação.
- Preferências.
- Configurações de privacidade.
- Exclusão de conta.

Permitir que visitantes naveguem pela loja sem precisar criar uma conta.

Não exigir cadastro antes de visualizar produtos.

---

# 8. NEXTECH ADMIN — PAINEL ADMINISTRATIVO

O painel administrativo é uma parte fundamental do projeto.

Desenvolver um ambiente separado, completo e funcional, para que o proprietário consiga controlar a loja sem precisar acessar diretamente o código ou o banco de dados.

O painel deverá possuir uma identidade visual monocromática, seguindo exatamente o design da loja.

## 8.1. Layout do painel

Criar um layout administrativo profissional.

### Sidebar lateral

Menu de navegação contendo:

- Visão geral.
- Produtos.
- Categorias.
- Lojas parceiras.
- Links de afiliados.
- Ofertas.
- Banners.
- Campanhas.
- Clientes.
- Analytics.
- Relatórios.
- Configurações.

A sidebar deverá possuir ícones minimalistas em preto e branco.

Deverá permitir recolhimento para liberar espaço na tela.

### Header administrativo

Apresentar:

- Título da página atual.
- Pesquisa administrativa.
- Notificações.
- Perfil do administrador.
- Opção de sair.

O painel deverá ser totalmente responsivo.

## 8.2. Dashboard administrativo

Ao acessar /admin, apresentar uma visão geral da operação.

Criar cards com indicadores:

- Total de produtos.
- Produtos ativos.
- Produtos inativos.
- Total de categorias.
- Cliques nos links de afiliados.
- Cliques nos últimos 30 dias.
- Conversões reportadas pelas redes.
- Comissões estimadas.
- Comissões pendentes.
- Comissões confirmadas.

Não misturar comissões estimadas com valores efetivamente confirmados.

Criar gráficos de:

- Cliques por dia.
- Produtos mais acessados.
- Categorias mais populares.
- Cliques por plataforma de afiliados.
- Evolução das comissões.
- Desempenho das campanhas.

Adicionar uma tabela de produtos com maior desempenho.

Criar filtros por:

- Hoje.
- Últimos 7 dias.
- Últimos 30 dias.
- Últimos 90 dias.
- Período personalizado.

Todos os indicadores e gráficos deverão utilizar dados reais do banco de dados ou integrações disponíveis.

## 8.3. Gestão de produtos

Criar uma área completa para administração dos produtos.

A tabela principal deverá apresentar:

- Imagem.
- Nome.
- Categoria.
- Preço.
- Loja parceira.
- Cliques.
- Status.
- Última atualização.
- Ações.

Permitir:

- Cadastrar produto.
- Editar produto.
- Excluir produto.
- Ativar produto.
- Desativar produto.
- Destacar produto na página inicial.
- Associar categorias.
- Associar marcas.
- Atualizar preços.
- Alterar links de afiliados.
- Visualizar detalhes.
- Consultar desempenho.

### Formulário de cadastro

Criar um formulário organizado por seções.

**Informações básicas:**
- Nome do produto.
- Slug.
- Descrição curta.
- Descrição completa.
- Marca.
- Categoria.
- Tags.

**Imagens:**
- Imagem principal.
- Galeria de imagens.
- Upload de imagens.
- Pré-visualização.

**Informações comerciais:**
- Preço atual.
- Preço anterior.
- Moeda.
- Percentual de desconto calculado automaticamente, quando aplicável.
- Loja parceira.
- Link original.
- Link de afiliado.
- Plataforma de afiliados.

**Informações adicionais:**
- Avaliação.
- Quantidade de avaliações.
- Características técnicas.
- SKU ou identificador externo.
- Destaque na página inicial.
- Status de publicação.

O formulário deverá possuir validação e mensagens de erro claras.

## 8.4. Gestão de categorias

Criar funcionalidades para:

- Criar categorias.
- Editar categorias.
- Excluir categorias.
- Definir nome.
- Definir slug.
- Definir descrição.
- Escolher ícone.
- Enviar imagem.
- Definir ordem de exibição.
- Ativar ou desativar.

## 8.5. Gestão de lojas parceiras

Criar uma área específica para gerenciar as lojas onde os produtos são comercializados.

Exemplos:

- Amazon.
- Mercado Livre.
- AliExpress.
- Outras lojas parceiras.

Cada loja deverá possuir:

- Nome.
- Logotipo.
- URL oficial.
- Descrição.
- Programa de afiliados associado.
- Status.
- Data de cadastro.

As lojas deverão ser associadas aos respectivos produtos.

## 8.6. Gestão de afiliados

Criar uma área para cadastrar e controlar os programas de afiliados.

Preparar a arquitetura para trabalhar com:

- Amazon Afiliados.
- Awin.
- Admitad.
- Impact.
- Outras plataformas.

Cada integração deverá possuir configurações próprias.

Permitir:

- Cadastrar rede de afiliados.
- Editar integração.
- Salvar identificadores.
- Gerenciar parâmetros de rastreamento.
- Visualizar links associados.
- Ver desempenho por rede.
- Consultar conversões recebidas.
- Consultar comissões.

Não presumir que as plataformas oferecem APIs idênticas. Desenvolver adaptadores independentes e respeitar as condições de cada programa.

Credenciais de integração deverão ser armazenadas de forma segura no servidor.

## 8.7. Gestão de ofertas

Criar uma área onde o administrador consiga selecionar produtos para a seção de ofertas.

Permitir:

- Criar oferta.
- Associar produto.
- Definir período de exibição.
- Definir destaque.
- Ativar ou desativar.
- Programar publicação.
- Remover oferta.

Não gerar descontos fictícios.

## 8.8. Gestão de banners

Permitir que o administrador controle os banners da página inicial.

Campos:

- Título.
- Subtítulo.
- Imagem.
- Link.
- Data inicial.
- Data final.
- Ordem.
- Status.

O administrador deverá conseguir visualizar uma prévia antes de publicar.

## 8.9. Gestão de campanhas

Criar uma área de campanhas para organizar ações comerciais.

Permitir:

- Criar campanha.
- Definir nome.
- Definir descrição.
- Associar produtos.
- Associar banners.
- Definir datas.
- Definir status.
- Acompanhar cliques.
- Acompanhar resultados.

## 8.10. Analytics e relatórios

Criar uma área completa de análise.

Apresentar:

- Total de visualizações.
- Visualizações por produto.
- Cliques nos links afiliados.
- Cliques por categoria.
- Cliques por loja.
- Taxa de cliques.
- Conversões reportadas.
- Comissões estimadas.
- Comissões confirmadas.

Permitir exportar relatórios em CSV.

Criar filtros por período, produto, categoria, campanha e rede de afiliados.

Importante: cliques não significam vendas. Conversões e comissões somente deverão ser registradas quando recebidas de uma fonte confiável, como uma integração ou relatório da rede afiliada.

## 8.11. Gestão de administradores

Preparar o sistema para diferentes níveis de acesso.

Perfis iniciais:

**Superadministrador**
- Acesso completo.
- Gerenciamento de usuários administrativos.
- Configurações gerais.
- Integrações.
- Produtos.
- Relatórios.

**Administrador**
- Gerenciamento de produtos.
- Categorias.
- Ofertas.
- Banners.
- Visualização de relatórios.

**Editor**
- Edição de produtos.
- Gerenciamento de conteúdo.
- Banners e campanhas.

Implementar controle de permissões no servidor, não somente ocultar opções na interface.

## 8.12. Configurações gerais

Criar uma área para controlar:

- Nome da loja.
- Logotipo.
- Favicon.
- Descrição institucional.
- E-mail de contato.
- Redes sociais.
- SEO.
- Configurações de analytics.
- Preferências de cookies.
- Configurações de integrações.
- Informações legais.

---

# 9. SISTEMA DE DADOS E BANCO DE DADOS

Utilizar PostgreSQL através do Supabase.

Planejar a estrutura com as seguintes tabelas:

- profiles.
- admin_users.
- admin_roles.
- admin_permissions.
- products.
- product_images.
- categories.
- brands.
- stores.
- affiliate_networks.
- affiliate_links.
- product_prices.
- favorites.
- browsing_history.
- searches.
- banners.
- campaigns.
- campaign_products.
- affiliate_clicks.
- analytics_events.
- affiliate_conversions.
- affiliate_commissions.
- site_settings.

Definir corretamente:

- Primary Keys.
- Foreign Keys.
- Relacionamentos.
- Índices.
- Constraints.
- Timestamps.
- Regras de integridade.

Implementar Row Level Security (RLS).

Os usuários não poderão acessar informações privadas de outros usuários.

Os usuários comuns não poderão acessar dados administrativos.

Nunca expor chaves secretas do Supabase ou credenciais de parceiros no frontend.

---

# 10. TECNOLOGIAS

Utilizar uma stack moderna e preparada para manutenção e escalabilidade.

**Frontend:**
- Next.js.
- React.
- TypeScript.
- Tailwind CSS.
- shadcn/ui.
- Lucide Icons.

**Backend:**
- Next.js API Routes.
- Server Actions quando apropriado.
- Serviços independentes para integrações externas.

**Banco de dados:**
- PostgreSQL.
- Supabase.

**Autenticação:**
- Supabase Auth.

**Armazenamento:**
- Supabase Storage.

**Deploy:**
- Vercel.

Organizar a aplicação em módulos, componentes reutilizáveis e serviços independentes.

---

# 11. SEGURANÇA E CONFIABILIDADE

Implementar:

- HTTPS.
- Validação de entradas.
- Proteção contra XSS.
- Proteção contra SQL Injection.
- Rate limiting.
- Controle de acesso.
- Proteção das rotas administrativas.
- Logs de operações importantes.
- Validação de URLs externas.
- Proteção de credenciais.
- Tratamento de exceções.

Não armazenar informações de cartões bancários ou dados de pagamento dos consumidores.

Como a compra acontece na loja parceira, deixar explícito que a transação é realizada fora da NEXTECH.

Não prometer garantias, reembolsos ou entrega realizados pela NEXTECH.

---

# 12. TRANSPARÊNCIA E CONFIANÇA

Criar páginas institucionais:

- Sobre a NEXTECH.
- Como funciona.
- Como ganhamos dinheiro.
- Política de privacidade.
- Termos de uso.
- Política de cookies.
- Contato.
- Perguntas frequentes.

Explicar claramente o modelo de negócio:

1. A NEXTECH apresenta produtos e oportunidades.
2. O consumidor escolhe o produto desejado.
3. O consumidor é direcionado para a loja parceira.
4. O pagamento é feito diretamente na loja parceira.
5. A NEXTECH pode receber uma comissão pela compra.

A comunicação deverá ser transparente, profissional e acessível.

Considerar as normas aplicáveis de proteção de dados e defesa do consumidor nos mercados em que a loja operar, incluindo LGPD e RGPD, conforme aplicável.

---

# 13. SEO E PERFORMANCE

Implementar:

- URLs amigáveis.
- Metadados dinâmicos.
- Sitemap.xml.
- Robots.txt.
- Open Graph.
- Dados estruturados adequados.
- Otimização de imagens.
- Lazy loading.
- Cache.
- Renderização otimizada para SEO.

Cada produto deverá ter uma página individual indexável.

A aplicação deverá apresentar carregamento rápido mesmo em dispositivos mais simples.

---

# 14. RESPONSIVIDADE

Toda a aplicação deverá ser responsiva.

Priorizar:

- Desktop.
- Notebook.
- Tablet.
- Smartphone.

A experiência mobile deverá receber atenção especial.

O catálogo, a pesquisa, os produtos e o painel administrativo deverão funcionar adequadamente em telas pequenas.

---

# 15. REGRAS FUNDAMENTAIS DO MODELO DE NEGÓCIO

A NEXTECH começará como uma plataforma de afiliados.

Portanto:

- Não implementar checkout próprio.
- Não implementar pagamento próprio.
- Não implementar estoque próprio.
- Não simular compras.
- Não criar pedidos fictícios.
- Não inventar avaliações.
- Não inventar preços.
- Não inventar descontos.
- Não inventar disponibilidade.
- Não inventar comissões.
- Não afirmar que o consumidor comprou um produto simplesmente porque clicou no link.

Criar uma arquitetura que permita adicionar novas plataformas de afiliados ao longo do tempo.

O sistema deverá distinguir dados manuais, dados importados e dados obtidos por integrações.

---

# 16. DIRETRIZES DE IMPLEMENTAÇÃO

Não desenvolver apenas uma landing page.

Desenvolver uma aplicação funcional, integrada ao banco de dados e com autenticação.

Seguir as etapas:

### Etapa 1 — Estrutura visual
- Criar identidade visual.
- Desenvolver design system.
- Criar layout principal.
- Desenvolver header.
- Desenvolver footer.
- Criar navegação.

### Etapa 2 — Loja pública
- Página inicial.
- Catálogo.
- Categorias.
- Pesquisa.
- Detalhes dos produtos.
- Favoritos.
- Redirecionamento de afiliados.

### Etapa 3 — Banco de dados
- Criar schema.
- Criar relacionamentos.
- Configurar RLS.
- Configurar autenticação.
- Criar serviços de dados.

### Etapa 4 — Painel administrativo
- Dashboard.
- Gestão de produtos.
- Gestão de categorias.
- Gestão de lojas.
- Gestão de afiliados.
- Gestão de ofertas.
- Gestão de banners.
- Analytics.
- Relatórios.
- Configurações.

### Etapa 5 — Integrações e rastreamento
- Integrações com redes de afiliados.
- Rastreamento de cliques.
- Importação de conversões.
- Importação de comissões.
- Relatórios de desempenho.

### Etapa 6 — Finalização
- SEO.
- Responsividade.
- Testes.
- Segurança.
- Performance.
- Deploy.

Não deixar botões sem funcionalidade.

Não utilizar informações fictícias como se fossem dados reais.

Não implementar recursos apenas visualmente. Todos os elementos interativos deverão possuir comportamento funcional.

---

# 17. RESULTADO FINAL ESPERADO

O resultado deverá ser uma plataforma de comércio eletrônico afiliado chamada NEXTECH, com identidade visual monocromática, elegante, minimalista e profissional.

A loja deverá proporcionar uma experiência extremamente agradável para o consumidor.

O painel administrativo deverá permitir que o proprietário controle toda a operação em um único ambiente, desde o cadastro de produtos até o acompanhamento dos resultados comerciais.

O projeto deverá ter qualidade visual de produto comercial, arquitetura organizada e estrutura técnica preparada para expansão.

**PRINCÍPIO DE DESIGN:**

Menos elementos, mais organização.

Menos cores, mais identidade.

Menos distrações, mais funcionalidade.

**PRINCÍPIO DO NEGÓCIO:**

A NEXTECH deve transformar a descoberta de produtos em uma experiência simples, transparente e confiável.
