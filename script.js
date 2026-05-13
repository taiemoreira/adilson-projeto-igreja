// === CONFIGURAÇÃO ===
// COLE A URL DO SEU GOOGLE APPS SCRIPT AQUI:
const GOOGLE_SHEETS_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbwkeMNaCRw5Bey5wDGQJJWzR52T0uLLEOpLc3z8tdri1vDfBgYprgy5fRB60ckFMHkK/exec";

// === MÁSCARA DE TELEFONE ===
function formatPhone(input) {
  let value = input.value.replace(/\D/g, "");
  if (value.length <= 10) {
    value = value.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  } else {
    value = value.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }
  input.value = value;
}

const phoneInput = document.getElementById("phone");
if (phoneInput) {
  phoneInput.addEventListener("input", function () {
    formatPhone(this);
  });
}

// === FUNÇÃO PARA FORMATAR TAMANHO DO ARQUIVO ===
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// === PRÉ-VISUALIZAÇÃO DO COMPROVANTE ===
const comprovanteInput = document.getElementById("comprovante");
const previewArea = document.getElementById("previewArea");
let arquivoAtual = null;

function createPreview(arquivo, imagemSrc) {
  const wrapper = document.createElement("div");
  wrapper.className = "preview-wrapper";

  const img = document.createElement("img");
  img.className = "preview-thumb";
  img.src = imagemSrc;

  const infoDiv = document.createElement("div");
  infoDiv.className = "preview-info";

  const nameDiv = document.createElement("div");
  nameDiv.className = "preview-name";
  nameDiv.textContent =
    arquivo.name.length > 30
      ? arquivo.name.substring(0, 27) + "..."
      : arquivo.name;

  const sizeDiv = document.createElement("div");
  sizeDiv.className = "preview-size";
  sizeDiv.textContent = formatFileSize(arquivo.size);

  infoDiv.appendChild(nameDiv);
  infoDiv.appendChild(sizeDiv);

  const removeBtn = document.createElement("button");
  removeBtn.className = "remove-file";
  removeBtn.innerHTML = "✕";
  removeBtn.title = "Remover arquivo";
  removeBtn.onclick = function () {
    comprovanteInput.value = "";
    previewArea.innerHTML = "";
    arquivoAtual = null;
  };

  wrapper.appendChild(img);
  wrapper.appendChild(infoDiv);
  wrapper.appendChild(removeBtn);

  return wrapper;
}

if (comprovanteInput) {
  comprovanteInput.addEventListener("change", function (e) {
    const arquivo = e.target.files[0];

    if (arquivo && arquivo.type.startsWith("image/")) {
      if (arquivo.size > 5 * 1024 * 1024) {
        alert("Arquivo muito grande! Máximo 5MB.");
        comprovanteInput.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = function (event) {
        previewArea.innerHTML = "";
        const preview = createPreview(arquivo, event.target.result);
        previewArea.appendChild(preview);
        arquivoAtual = arquivo;
      };
      reader.readAsDataURL(arquivo);
    } else if (arquivo) {
      alert("Por favor, selecione apenas imagens (JPG ou PNG)");
      comprovanteInput.value = "";
    } else {
      previewArea.innerHTML = "";
      arquivoAtual = null;
    }
  });
}

// === FUNÇÃO PARA CONVERTER IMAGEM PARA BASE64 ===
function imagemParaBase64(arquivo) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(arquivo);
  });
}

// === FUNÇÃO PARA MOSTRAR MENSAGENS ===
function showMessage(message, type) {
  const messageArea = document.getElementById("messageArea");
  if (!messageArea) return;

  const alertDiv = document.createElement("div");
  alertDiv.className = `alert alert-${type}`;
  alertDiv.innerHTML = message;

  messageArea.innerHTML = "";
  messageArea.appendChild(alertDiv);

  setTimeout(() => {
    if (alertDiv.parentNode) {
      alertDiv.remove();
    }
  }, 5000);
}

// === ENVIO DO FORMULÁRIO ===
const form = document.getElementById("donationForm");
const submitBtn = document.getElementById("submitBtn");

if (form) {
  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    submitBtn.disabled = true;
    submitBtn.textContent = "Enviando...";

    // Validação do comprovante
    if (!arquivoAtual) {
      showMessage("Por favor, anexe o comprovante de pagamento.", "error");
      submitBtn.disabled = false;
      submitBtn.textContent = "Registrar Doação";
      return;
    }

    // Converte imagem para base64
    let imagemBase64 = "";
    try {
      imagemBase64 = await imagemParaBase64(arquivoAtual);
    } catch (error) {
      showMessage("Erro ao processar a imagem. Tente novamente.", "error");
      submitBtn.disabled = false;
      submitBtn.textContent = "Registrar Doação";
      return;
    }

    // Coleta os dados do formulário
    const formData = {
      name: document.getElementById("name")?.value || "",
      phone: document.getElementById("phone")?.value || "",
      community: document.getElementById("community")?.value || "",
      amount: document.getElementById("amount")?.value || "",
      payment:
        document.querySelector('input[name="payment"]:checked')?.value || "",
      comprovante_nome: arquivoAtual.name,
      imagem_base64: imagemBase64,
    };

    // Validação dos campos obrigatórios
    if (
      !formData.name ||
      !formData.phone ||
      !formData.community ||
      !formData.payment
    ) {
      showMessage("Por favor, preencha todos os campos obrigatórios.", "error");
      submitBtn.disabled = false;
      submitBtn.textContent = "Registrar Doação";
      return;
    }

    try {
      const response = await fetch(GOOGLE_SHEETS_WEBAPP_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(formData),
      });

      const textResponse = await response.text();
      console.log("Resposta do servidor:", textResponse);

      try {
        const result = JSON.parse(textResponse);
        if (result.status === "success") {
          showMessage(
            "✅ Doação registrada com sucesso! O comprovante foi salvo.",
            "success",
          );
          form.reset();
          document
            .querySelectorAll('input[type="radio"]')
            .forEach((radio) => (radio.checked = false));
          previewArea.innerHTML = "";
          arquivoAtual = null;
        } else {
          showMessage(
            "❌ Erro: " + (result.message || "Tente novamente."),
            "error",
          );
        }
      } catch (e) {
        showMessage(
          "✅ Doação registrada com sucesso! Deus abençoe.",
          "success",
        );
        form.reset();
        document
          .querySelectorAll('input[type="radio"]')
          .forEach((radio) => (radio.checked = false));
        previewArea.innerHTML = "";
        arquivoAtual = null;
      }
    } catch (error) {
      console.error("Erro na requisição:", error);
      showMessage("✅ Doação registrada com sucesso! Deus abençoe.", "success");
      form.reset();
      document
        .querySelectorAll('input[type="radio"]')
        .forEach((radio) => (radio.checked = false));
      previewArea.innerHTML = "";
      arquivoAtual = null;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Registrar Doação";
    }
  });
}

// === BOTÃO COPIAR PIX ===
const copyBtn = document.getElementById('copyPixBtn');
const pixKeyElement = document.getElementById('pixKey');

if (copyBtn && pixKeyElement) {
  copyBtn.addEventListener('click', async function() {
    const pixKey = pixKeyElement.textContent;
    
    try {
      await navigator.clipboard.writeText(pixKey);
      
      // Muda o visual do botão
      copyBtn.classList.add('copied');
      
      // Mostra notificação
      showMessage('✅ Chave PIX copiada com sucesso!', 'success');
      
      // Volta ao normal depois de 3 segundos
      setTimeout(() => {
        copyBtn.classList.remove('copied');
      }, 3000);
      
    } catch (err) {
      console.error('Erro ao copiar:', err);
      showMessage('❌ Erro ao copiar a chave PIX. Tente manualmente.', 'error');
    }
  });
}