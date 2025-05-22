document.addEventListener("DOMContentLoaded", async () => {
  const maxLength = 100;

  try {
    const shop = window.Shopify.shop;
    const response = await fetch(`apps/extensions?shop=${shop}`);

    if (!response?.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();

    const maxReviews = data.data.maxReviews ?? 5;
    const reviews = data.data.details.reviews;
    const widget = data.data.widget;

    const reviewContainer = document.querySelector(".review-container");

    if (maxReviews === 0) {
      reviewContainer.innerHTML = "";
    }

    const reviewCards = document.querySelectorAll(".review-card");

    reviews.slice(0, maxReviews).forEach((review, index) => {
      const container = reviewCards[index];
      if (!container) return;

      container.style.backgroundColor = widget.background_color;
      container.style.borderWidth = `${widget.border_width}px`;
      container.style.borderColor = widget.border_color;
      container.style.borderStyle = "solid";
      container.style.borderRadius = `${widget.border_radius}px`;

      const platformLogoElement = container.querySelector(
        ".review-platform-logo",
      );
      const starsContainer = container.querySelector(".review-stars");
      const descriptionElement = container.querySelector(".review-description");
      const logoElement = container.querySelector(".review-logo");
      const authorElement = container.querySelector(".review-author");
      const dateElement = container.querySelector(".review-date");
      const readMoreLink = container.querySelector(".read-more");

      const filledStars = review.rating;
      const blankStars = 5 - filledStars;

      const filledStarSrc = starsContainer.getAttribute("data-filled-star-src");
      const blankStarSrc = starsContainer.getAttribute("data-blank-star-src");

      if (platformLogoElement) {
        platformLogoElement.style.display = widget.show_platform_logo
          ? "block"
          : "none";
      }

      if (starsContainer) {
        if (widget.show_rating) {
          starsContainer.innerHTML = "";
          for (let i = 0; i < filledStars; i++) {
            starsContainer.innerHTML += `
            <img
              class="review-star-filled"
              src="${filledStarSrc}"
              height="30"
              width="30"
              loading="lazy"
            >
          `;
          }

          for (let i = 0; i < blankStars; i++) {
            starsContainer.innerHTML += `
            <img
              class="review-star-empty"
              src="${blankStarSrc}"
              height="30"
              width="30"
              loading="lazy"
            >
          `;
          }
        } else {
          starsContainer.innerHTML = "";
        }
      }

      if (descriptionElement) {
        const fullText = review.text;
        descriptionElement.setAttribute("data-full-text", fullText);
        descriptionElement.textContent =
          fullText.length > maxLength
            ? fullText.substring(0, maxLength) + "..."
            : fullText;
        descriptionElement.style.color = widget.text_primary_color;
      }

      if (logoElement) {
        if (widget.show_avatar) {
          logoElement.src = review.profile_photo_url;
          logoElement.alt = review.author_name;
        } else {
          logoElement.style.display = "none";
        }
      }

      if (authorElement) {
        if (widget.show_name) {
          authorElement.textContent = review.author_name;
          authorElement.style.color = widget.text_primary_color;
        } else {
          authorElement.innerHTML = "";
        }
      }

      if (dateElement) {
        if (widget.show_date) {
          dateElement.textContent = review.relative_time_description;
          dateElement.style.color = widget.text_secondary_color;
        } else {
          dateElement.innerHTML = "";
        }
      }

      if (readMoreLink) {
        readMoreLink.addEventListener("click", (e) => {
          e.preventDefault();
          const description = descriptionElement;
          const fullText = description.getAttribute("data-full-text");

          if (readMoreLink.textContent === "Read More") {
            description.textContent = fullText;
            readMoreLink.textContent = "Read Less";
          } else {
            description.textContent = fullText.substring(0, maxLength) + "...";
            readMoreLink.textContent = "Read More";
          }
        });
        readMoreLink.style.color = widget.text_secondary_color;
      }

      for (let i = maxReviews; i < reviewCards.length; i++) {
        reviewCards[i].innerHTML = "";
      }
    });
  } catch (error) {
    console.error("Error fetching data:", error);
  }
});

async function loadReviews() {
  try {
    const response = await fetch("https://dummyjson.com/comments?limit=10");
    const data = await response.json();
    const reviews = data.comments;

    const reviewSection = document.getElementById('review-section');

    reviews.forEach((review, index) => {
      const reviewCard = document.createElement('div');
      reviewCard.className = 'review-card';

      // You can randomly simulate stars (e.g., 3 to 5)
      const filledStars = Math.floor(Math.random() * 3) + 3; // 3 to 5
      const blankStars = 5 - filledStars;

      const starsHTML = `
        <div class="review-stars">
          ${'<img class="review-star-filled" src="' + window.starFilledSrc + '" width="30" height="30">'.repeat(filledStars)}
          ${'<img class="review-star-empty" src="' + window.starBlankSrc + '" width="30" height="30">'.repeat(blankStars)}
        </div>
      `;

      reviewCard.innerHTML = `
        
        <p class="review-description">${review.body}</p>
        <a href="#" class="read-more">Read More</a>
        <h4 class="review-author">${review.user?.username || "Anonymous"}</h4>
        <p class="review-date">just now</p>
      `;

      reviewSection.appendChild(reviewCard);
    });

  } catch (error) {
    console.error("Error fetching reviews:", error);
  }
}

// Store dynamic asset URLs from Liquid into global variables (set in Liquid)
window.googleLogoSrc = "{{ 'google.png' | asset_img_url: '30x' }}";
window.starFilledSrc = "{{ 'icons8-star-96.png' | asset_img_url: '30x' }}";
window.starBlankSrc = "{{ 'icons8-star-52.png' | asset_img_url: '30x' }}";

document.addEventListener('DOMContentLoaded', loadReviews);