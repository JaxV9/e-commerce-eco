import asyncHandler from '../middleware/asyncHandler.js';
import Product from '../models/productModel.js';
import NodeCache from 'node-cache';

//init the cache with the duration
const cache = new NodeCache({ stdTTL: 300 });

// @desc    Fetch all products
// @route   GET /api/products
// @access  Public
const getProducts = asyncHandler(async (req, res) => {
  const pageSize = process.env.PAGINATION_LIMIT || 8;
  const page = Number(req.query.pageNumber) || 1;
  const keywordStr = req.query.keyword ? req.query.keyword.toString() : '';

  //unique cache key
  const cacheKey = `products_page_${page}_keyword_${keywordStr}`;

  //check if data is in the cache
  if (cache.has(cacheKey)) {
    // Cache HIT: Return data from memory
    res.set('X-Cache', 'HIT');
    return res.json(cache.get(cacheKey));
  }

  //if cache MISS, then fetch from DB
  res.set('X-Cache', 'MISS');

  const keyword = req.query.keyword
    ? {
        name: {
          $regex: req.query.keyword,
          $options: 'i',
        },
      }
    : {};

  const count = await Product.countDocuments({ ...keyword });
  const products = await Product.find({ ...keyword })
    .limit(pageSize)
    .skip(pageSize * (page - 1));

  const responseData = { products, page, pages: Math.ceil(count / pageSize) };
  
  //convert to plain object
  const plainResponseData = JSON.parse(JSON.stringify(responseData));
  
  //store result in cache
  cache.set(cacheKey, plainResponseData);

  res.json(plainResponseData);
});

// @desc    Fetch single product
// @route   GET /api/products/:id
// @access  Public
const getProductById = asyncHandler(async (req, res) => {
  // NOTE: checking for valid ObjectId to prevent CastError moved to separate
  // middleware. See README for more info.

  const product = await Product.findById(req.params.id);
  if (product) {
        return res.json(product);
  } else {
    // NOTE: this will run if a valid ObjectId but no product was found
    // i.e. product may be null
    res.status(404);
    throw new Error('Product not found');
  }
});

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
const createProduct = asyncHandler(async (req, res) => {
  const product = new Product({
    name: 'Sample name',
    price: 0,
    user: req.user._id,
    image: '/images/sample.jpg',
    brand: 'Sample brand',
    category: 'Sample category',
    countInStock: 0,
    numReviews: 0,
    description: 'Sample description',
  });

  //we clear the cache whenever a product is created, to ensure that the new product appears in all lists
  const createdProduct = await product.save();
  cache.flushAll(); 
  res.status(201).json(createdProduct);
});

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
const updateProduct = asyncHandler(async (req, res) => {
  const { name, price, description, image, brand, category, countInStock } =
    req.body;

  const product = await Product.findById(req.params.id);

  if (product) {
    product.name = name;
    product.price = price;
    product.description = description;
    product.image = image;
    product.brand = brand;
    product.category = category;
    product.countInStock = countInStock;

    //clear cache to reflect the updated product details
    const updatedProduct = await product.save();
    cache.flushAll();
    res.json(updatedProduct);
  } else {
    res.status(404);
    throw new Error('Product not found');
  }
});

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (product) {
    //clear cache to remove the deleted product from lists
    await Product.deleteOne({ _id: product._id });
    cache.flushAll();
    res.json({ message: 'Product removed' });
  } else {
    res.status(404);
    throw new Error('Product not found');
  }
});

// @desc    Create new review
// @route   POST /api/products/:id/reviews
// @access  Private
const createProductReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;

  const product = await Product.findById(req.params.id);

  if (product) {
    const alreadyReviewed = product.reviews.find(
      (r) => r.user.toString() === req.user._id.toString()
    );

    if (alreadyReviewed) {
      res.status(400);
      throw new Error('Product already reviewed');
    }

    const review = {
      name: req.user.name,
      rating: Number(rating),
      comment,
      user: req.user._id,
    };

    product.reviews.push(review);

    product.numReviews = product.reviews.length;

    product.rating =
      product.reviews.reduce((acc, item) => item.rating + acc, 0) /
      product.reviews.length;

    //clear cache to update review counts and ratings in product lists
    await product.save();
    cache.flushAll();
    res.status(201).json({ message: 'Review added' });
  } else {
    res.status(404);
    throw new Error('Product not found');
  }
});

// @desc    Get top rated products
// @route   GET /api/products/top
// @access  Public
const getTopProducts = asyncHandler(async (req, res) => {
  const cacheKey = 'top_products';
  
  // Check cache for top products
  if (cache.has(cacheKey)) {
    res.set('X-Cache', 'HIT');
    return res.json(cache.get(cacheKey));
  }

  res.set('X-Cache', 'MISS');

  const products = await Product.find({}).sort({ rating: -1 }).limit(3);
  
  //store top products in cache
  cache.set(cacheKey, products);
  res.json(products);
});

export {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  createProductReview,
  getTopProducts,
};
