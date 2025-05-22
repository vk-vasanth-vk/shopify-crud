// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  const targetButton = document.querySelector('.product-form__submit.button.button--full-width.button--secondary');

  if (!targetButton) {
    console.log('Button not found!');
    return;
  }

  // Inject modal HTML
  const modalHTML = `
    <div id="vkModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%;
      background-color: rgba(0,0,0,0.5); z-index:9999; justify-content:center; align-items:center;">
      <div style="background:white; padding:20px; border-radius:8px; max-width:400px; text-align:center;">
        <p>This is a custom popup from your App Embed Block!</p>
        <button id="closeModal" style="margin-top: 10px; padding: 8px 16px; background: #000; color: #fff; border: none; border-radius: 4px;">Close</button>
      </div>
    </div>
  `;

  const modalContainer = document.createElement('div');
  modalContainer.innerHTML = modalHTML;
  document.body.appendChild(modalContainer);

  const vkModal = document.getElementById('vkModal');
  const closeModal = document.getElementById('closeModal');

  // Show popup when button is clicked
  targetButton.addEventListener('click', (e) => {
    e.preventDefault(); // Stop default behavior for demo
    vkModal.style.display = 'flex';
  });

  // Close popup
  closeModal.addEventListener('click', () => {
    vkModal.style.display = 'none';
  });
});
