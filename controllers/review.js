import { prisma } from "../config/db.js";


/**
 * @Description This function is used to add a review to the database
 * @Route POST /api/review/add
 * @Acess Private
 */
export const addReview = async (req, res) => {
  const userId = req.user.id;
  const { rating, comment } = req.body;

  try {
    if (!rating) {
      return res.status(400).json({ error: "Rating is required" });
    }

    const parsedRating = parseInt(rating, 10);

    const review = await prisma.review.create({
      data: {
        userId,
        rating: parsedRating,
        comment: comment || "",
      },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { isReviewed: true },
    });

    return res.status(200).json({
      message: "Review submitted successfully",
      review,
    });
  } catch (error) {
    console.error("Error adding review:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
