Esta política explica quais dados pessoais a {{store_name}} trata, para quê, com quem compartilha e quais são os seus direitos, de acordo com a Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018).

## Quem é o controlador

Controlador dos dados: {{seller_identity}}.

Canal de privacidade e contato do encarregado pelo tratamento de dados (LGPD, art. 41): {{contact_email}}.

## Quais dados tratamos

**Conta**

- Nome, e-mail, data de criação, preferências de idioma e país e o registro das suas escolhas sobre o histórico de navegação.
- Senha: é gerenciada pelo nosso provedor de autenticação e nós não temos acesso a ela em texto legível.

**Compra e entrega**

- Nome do destinatário, CPF, telefone, e-mail e endereço de entrega. O CPF é obrigatório no checkout e é usado na identificação da compra, no boleto e, quando emitida, na nota fiscal.
- Data de nascimento: pedida no checkout somente para confirmar que você tem 18 anos ou mais. Fica no seu perfil, não é copiada para o pedido, não é enviada a parceiros e não é usada para marketing nem para promoções de aniversário. Você pode corrigir ou apagar em **Minha conta**.
- Produtos, valores, forma de pagamento, status, histórico e código de rastreio do pedido, além da nota fiscal, quando emitida.
- Do pagamento, guardamos a confirmação, a forma de pagamento e, no cartão, a bandeira e os 4 últimos dígitos. Os dados do cartão são digitados diretamente no componente da Stripe: **não recebemos nem guardamos o número completo do cartão.**

**Atendimento**

- Solicitações de devolução ou suporte: motivo, mensagem e até 3 fotos enviadas por você.
- Reembolso de boleto: a chave Pix ou os dados bancários que você nos informar.
- Sugestões e relatos de problema enviados pelo balão da loja: o tipo, o texto, a página em que você estava (sem os parâmetros do endereço) e a sua conta.
- Formulário de contato: nome, e-mail, assunto e mensagem.

**Recursos opcionais**

- Favoritos, endereços salvos (com CPF e telefone) e, **somente se você ativar**, o histórico de produtos vistos.

**Navegação**

- Sem identificar você, registramos eventos de uso (página inicial, categoria ou produto visto, idioma, país, se o acesso parece ser de um robô) e os termos buscados, sem endereço IP.
- Com o seu consentimento para cookies de análise, esses registros incluem também um identificador aleatório de sessão (`nx_sid`) e a página de origem, e as buscas feitas com login ficam ligadas à sua conta.
- Para evitar abusos, usamos um código gerado a partir do seu endereço IP (hash, não o IP em si) em limites de tentativas.
- Nossa hospedagem processa dados técnicos da conexão, como endereço IP e tipo de navegador, para entregar o site.
- O carrinho e os favoritos de quem não tem conta ficam guardados no seu navegador.

Não pedimos dados pessoais sensíveis. Evite incluí-los em mensagens ou fotos.

## Para que usamos e com qual base legal (LGPD, art. 7º)

| Finalidade | Base legal |
|---|---|
| Criar e manter a conta, processar pedido, pagamento, entrega, cancelamento, devolução e atendimento | Execução de contrato (art. 7º, V) |
| Confirmar que o comprador tem 18 anos ou mais, para que a compra seja válida | Execução de contrato (art. 7º, V) |
| Guardar registros fiscais e de consumo | Cumprimento de obrigação legal (art. 7º, II) |
| Defender direitos em processos, reclamações e contestações de pagamento | Exercício regular de direitos (art. 7º, VI) |
| Analisar sugestões e relatos de problema para corrigir falhas e melhorar a loja | Legítimo interesse (art. 7º, IX) |
| Segurança, prevenção a fraudes e abusos, estatísticas de uso e métricas internas pseudonimizadas | Legítimo interesse (art. 7º, IX) |
| Cookies de análise e de marketing e histórico de produtos vistos | Consentimento (art. 7º, I), que você pode revogar a qualquer momento |

## Com quem compartilhamos

- **Supabase:** banco de dados, autenticação e armazenamento de arquivos, com dados hospedados na região de Frankfurt, Alemanha (eu-central-1). Os e-mails de confirmação de cadastro e de recuperação de senha partem do serviço de autenticação.
- **Stripe:** processamento de pagamentos. Recebe valor, número do pedido, e-mail e os dados do cartão; no boleto e no Pix, também nome e endereço; no boleto, também o CPF. A Stripe usa o e-mail para o comprovante de pagamento dela.
- **Vercel:** hospedagem e entrega do site.
- **Fornecedores, marketplaces e distribuidores, no Brasil ou no exterior (produtos enviados por parceiros):** nome, telefone e endereço de entrega e, quando exigido para a compra, a emissão fiscal ou o transporte, o CPF.
- **Transportadoras:** nome, endereço de entrega, telefone e, quando exigido para a emissão fiscal ou o transporte, o CPF.
- **ViaCEP:** quando você digita o CEP no checkout, seu navegador consulta esse serviço público, que recebe o CEP e os dados técnicos da conexão, para preencher o endereço.
- **NexForge:** quando essa integração está ativa, o painel interno de métricas de gestão recebe eventos pseudonimizados: código irreversível sem a chave da loja, nome do evento e, nas compras e reembolsos, valor, moeda, quantidade e produto, categoria e marca vendidos. Não enviamos nome, e-mail, CPF, data de nascimento, endereço nem número do pedido. Esses eventos não são apagados com a conta. A exceção são as sugestões e os relatos de problema enviados pelo balão da loja: uma cópia do tipo, do texto que você escreveu e da página vai para esse painel, sem nome, e-mail nem identificação da conta. Por isso, não escreva dados pessoais nessas mensagens.
- **Resend:** quando o envio de e-mails do pedido está ativo, recebe seu e-mail, seu nome e os dados do pedido para enviar as mensagens.
- **Google (Ads e Analytics), Meta (Pixel) e Plausible:** somente quando essas ferramentas estão ativadas pela loja e você aceitou a categoria de cookies correspondente. Google e Meta recebem as páginas visitadas (o endereço pode conter o número do pedido) e dados técnicos do navegador. A Meta também recebe adição ao carrinho e início de checkout, com códigos dos produtos e valor. Nas compras, Google Ads e Meta recebem valor, moeda e número do pedido. Usamos o Modo de Consentimento do Google: sem o seu aceite, armazenamento de anúncios e de análise ficam negados.
- **Autoridades públicas:** quando exigido por lei ou ordem judicial.

Não vendemos seus dados pessoais.

## Transferência internacional

Nosso banco de dados fica na União Europeia, e alguns dos parceiros acima tratam dados nos Estados Unidos ou em outros países, inclusive fornecedores no exterior. Essas transferências ocorrem quando necessárias para executar o contrato com você, cumprir obrigação legal ou exercer direitos (LGPD, art. 33, IX) ou com o seu consentimento específico, no caso das ferramentas de análise e marketing (art. 33, VIII).

## Por quanto tempo guardamos

| Dados | Prazo |
|---|---|
| Conta, data de nascimento, favoritos e endereços salvos | Até você remover ou excluir a conta |
| Histórico de produtos vistos | Até você limpar o histórico ou excluir a conta |
| Pedidos, pagamentos, notas fiscais, solicitações de devolução e histórico do pedido | No mínimo **5 anos**, por obrigações fiscais e pelo prazo de reclamação do Código de Defesa do Consumidor, **mesmo que você exclua a conta** |
| Mensagens do formulário de contato | Pelo tempo necessário ao atendimento e à defesa de direitos |
| Sugestões e relatos de problema | Até você excluir a conta. A cópia no painel da NexForge não fica ligada à conta e não é apagada com ela; para pedir a eliminação, use o canal de privacidade |
| Eventos de uso e buscas detalhados | Até 13 meses; depois são excluídos ou resumidos em totais diários sem identificação |
| Código de limite de tentativas | Cerca de 1 dia |

Ao excluir a conta, os dados de perfil, favoritos, histórico, endereços salvos e sugestões e relatos de problema são apagados. O pedido deixa de ficar vinculado à conta, mas os dados de compra (inclusive nome, CPF, e-mail, telefone e endereço) continuam guardados pelo prazo acima. Depois desse prazo, você pode pedir a eliminação pelo canal de privacidade. Parceiros como a Stripe têm prazos próprios para seus registros.

## Seus direitos (LGPD, art. 18)

Você pode pedir confirmação do tratamento, acesso, correção, anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade, portabilidade, eliminação de dados tratados com consentimento, informação sobre compartilhamento e sobre a possibilidade de negar consentimento, além de revogar consentimentos e se opor a tratamentos irregulares.

Em **Minha conta → Privacidade** você mesmo pode exportar seus dados da conta (perfil, favoritos, histórico, pedidos, endereços, solicitações, sugestões e relatos de problema), remover endereços salvos, controlar o histórico, alterar as escolhas de cookies e excluir a conta. Para o restante, escreva para {{contact_email}}. Poderemos pedir informações para confirmar sua identidade. Pedidos de acesso completo são respondidos em até 15 dias (LGPD, art. 19).

Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD) e aos órgãos de defesa do consumidor.

## Cookies

Usamos cookies essenciais para a sessão de login (`sb-*`), para guardar suas escolhas (`nx_consent`) e as preferências da loja e, somente com o seu consentimento, cookies de análise e de marketing. No checkout e na conclusão do pedido, o componente da Stripe pode usar cookies próprios. Detalhes na página **Política de cookies**. Você pode mudar suas escolhas a qualquer momento em “Preferências de cookies”, no rodapé.

## Menores de idade

A loja não é direcionada a menores de 18 anos e não coleta dados de menores de propósito. No checkout pedimos a data de nascimento e só aceitamos compras de maiores de 18 anos; a data informada é de responsabilidade de quem compra, e o cadastro em si não verifica a idade. Se você é responsável por uma criança ou adolescente que nos enviou dados, fale com a gente: {{contact_email}}.

## Segurança e incidentes

Usamos conexão criptografada (HTTPS), controle de acesso por conta e por perfil no painel administrativo, regras no banco de dados que limitam cada cliente aos próprios dados e arquivos privados para fotos de devolução e notas fiscais. Nenhum sistema é totalmente seguro, por isso não podemos garantir segurança absoluta. Se ocorrer um incidente que possa causar risco ou dano relevante a você, comunicaremos a você e à ANPD, como exige o art. 48 da LGPD.

## Alterações

Podemos atualizar esta política para refletir mudanças na loja ou na lei. A versão vigente fica sempre nesta página, com a data da última atualização no topo.
