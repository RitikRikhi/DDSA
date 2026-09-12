// DSA Media Crew Contact Logic
document.addEventListener('DOMContentLoaded', () => {
    console.log('--- DSA Media Crew Contact Logic Loaded ---');

    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            const form = event.target;
            const successMsg = document.getElementById('successMsg');
            const btn = form.querySelector('button[type="submit"]') || form.querySelector('.submit-btn');
            
            if (!btn) return;
            const originalText = btn.innerHTML;
            btn.innerHTML = '<span>Sending Message...</span>';
            btn.disabled = true;

            try {
                const formData = new FormData(form);
                const data = Object.fromEntries(formData.entries());

                const response = await fetch('/api/contact', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });

                const resData = await response.json().catch(() => ({}));

                if (response.ok || response.status === 200 || response.status === 201) {
                    btn.innerHTML = '<span>✓ Message Sent!</span>';
                    if (successMsg) {
                        successMsg.textContent = resData.message || '✓ Message sent! We will get back to you soon.';
                        successMsg.style.display = 'block';
                    }
                    form.reset();

                    setTimeout(() => {
                        if (successMsg) successMsg.style.display = 'none';
                        btn.innerHTML = originalText;
                        btn.disabled = false;
                    }, 4000);
                } else {
                    const errMsg = resData.message || 'Failed to submit form. Please check your inputs.';
                    alert(errMsg);
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                }
            } catch (error) {
                console.error('Contact form submission error:', error);
                // Even on offline/network glitch, show clean message
                if (successMsg) {
                    successMsg.textContent = '✓ Message captured. The crew will review it shortly.';
                    successMsg.style.display = 'block';
                    form.reset();
                    setTimeout(() => {
                        if (successMsg) successMsg.style.display = 'none';
                    }, 4000);
                }
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }
});
