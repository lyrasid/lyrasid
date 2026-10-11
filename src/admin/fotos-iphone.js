// Fotos do iPhone (HEIC/HEIF) viram JPEG antes de o painel recebê-las.
//
// O painel só comprime JPEG, PNG, WebP, AVIF e GIF: um HEIC passaria direto, iria para o
// repositório como .heic e o compressor do site (sharp) não lê esse formato, então a
// publicação quebraria. Aqui a foto é trocada por um JPEG no momento em que é escolhida ou
// arrastada; depois o painel faz o de sempre (reduz para 2048px e grava em WebP).
//
// A conversão usa a biblioteca heic-to (libheif, LGPL-3.0), copiada para o painel na
// publicação. Ela pesa uns 3 MB e só é baixada quando aparece um HEIC.
//
// Se o painel mudar por dentro e isto parar de funcionar, a foto chega sem converter, como
// antes: aí vale passar a foto para JPEG antes ou usar "Mais compatível" na câmera do iPhone.
(() => {
  const endereco = new URL("heic-to.js", document.currentScript.src).href;
  let biblioteca;
  const carregar = () => (biblioteca ??= import(endereco));

  const ehHeic = (arquivo) => /image\/hei[cf]/i.test(arquivo.type) || /\.hei[cf]$/i.test(arquivo.name);

  async function converter(arquivos) {
    const { heicTo } = await carregar();
    return Promise.all(
      arquivos.map(async (arquivo) => {
        if (!ehHeic(arquivo)) return arquivo;
        const jpeg = await heicTo({ blob: arquivo, type: "image/jpeg", quality: 0.92 });
        return new File([jpeg], arquivo.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg", lastModified: arquivo.lastModified });
      })
    );
  }

  const listaDe = (arquivos) => {
    const dt = new DataTransfer();
    arquivos.forEach((a) => dt.items.add(a));
    return dt;
  };

  // aviso enquanto converte: a primeira vez demora o download da biblioteca
  function avisar(texto) {
    const aviso = Object.assign(document.createElement("div"), { className: "aviso-iphone", textContent: texto });
    aviso.setAttribute("role", "status");
    document.body.append(aviso);
    return aviso;
  }

  async function trocar(arquivos, devolver) {
    const aviso = avisar("Convertendo foto do iPhone…");
    try {
      devolver(listaDe(await converter(arquivos)));
    } catch (erro) {
      console.error(erro);
      alert("Não deu para converter a foto do iPhone (HEIC). Salve como JPEG e envie de novo.");
    } finally {
      aviso.remove();
    }
  }

  // Escolher arquivo: segura o "change" antes do painel, troca os arquivos do campo e solta de novo.
  // Na captura do document o evento é parado antes de chegar ao campo.
  document.addEventListener(
    "change",
    (e) => {
      const campo = e.target;
      if (!(campo instanceof HTMLInputElement) || campo.type !== "file") return;
      const arquivos = [...(campo.files || [])];
      if (!arquivos.some(ehHeic)) return;
      e.stopImmediatePropagation();
      trocar(arquivos, (dt) => {
        campo.files = dt.files;
        campo.dispatchEvent(new Event("change", { bubbles: true }));
      });
    },
    true
  );

  // Arrastar para a área de envio: o painel lê o "drop" por um caminho que não aceita arquivo
  // criado por script, então os JPEG entram pelo campo de arquivo da mesma área (o do botão
  // "Procurar"), como se tivessem sido escolhidos ali.
  const campoPerto = (elemento) => {
    for (let el = elemento; el && el !== document; el = el.parentElement) {
      const campo = el.querySelector?.('input[type="file"]');
      if (campo) return campo;
    }
    return null;
  };
  document.addEventListener(
    "drop",
    (e) => {
      const arquivos = [...(e.dataTransfer?.files || [])];
      const campo = campoPerto(e.target);
      if (!campo || !arquivos.some(ehHeic)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      trocar(arquivos, (dt) => {
        campo.files = dt.files;
        campo.dispatchEvent(new Event("change", { bubbles: true }));
      });
    },
    true
  );
})();
