const fs = require('fs');
const path = require('path');
const stripe = require('stripe')(process.env.PAYMENT_STRIPE);

const PDFDocument = require('pdfkit');

const Product = require('../models/product');
const Order = require('../models/order');

const PRODUCT_PER_PAGE = 1;

exports.getProducts = (req, res, next) => {
  const page = +req.query.page || 1;
  Product.find().countDocuments().then(numProducts => {
    totalProducts = numProducts;
    return Product.find()
    .skip((page-1) * PRODUCT_PER_PAGE)
    .limit(PRODUCT_PER_PAGE)
  }).then(products => {
      res.render('shop/index', {
        prods: products,
        pageTitle: 'Shop',
        path: '/',
        currentPage:page,
        hasNext : PRODUCT_PER_PAGE * page < totalProducts,
        hasPrev : PRODUCT_PER_PAGE * page > 1,
        nextPage: page + 1,
        prevPage:page - 1,
        lastPage:Math.ceil(totalProducts/PRODUCT_PER_PAGE)                                            
      });
    })
    .catch(err => {
      console.log(err);
    });
  };

exports.getProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then(product => {
      res.render('shop/product-detail', {
        product: product,
        pageTitle: product.title,
        path: '/products',
      });
    })
    .catch(err => console.log(err));
};

exports.getIndex = (req, res, next) => {
  const page = +req.query.page || 1;
  Product.find().countDocuments().then(numProducts => {
    totalProducts = numProducts;
    return Product.find()
    .skip((page-1) * PRODUCT_PER_PAGE)
    .limit(PRODUCT_PER_PAGE)
  }).then(products => {
      res.render('shop/index', {
        prods: products,
        pageTitle: 'Shop',
        path: '/',
        currentPage:page,
        hasNext : PRODUCT_PER_PAGE * page < totalProducts,
        hasPrev : PRODUCT_PER_PAGE * page > 1,
        nextPage: page + 1,
        prevPage:page - 1,
        lastPage:Math.ceil(totalProducts/PRODUCT_PER_PAGE)                                            
      });
    })
    .catch(err => {
      console.log(err);
    });
};

exports.getCart = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .execPopulate()
    .then(user => {
      const products = user.cart.items;
      res.render('shop/cart', {
        path: '/cart',
        pageTitle: 'Your Cart',
        products: products,
      });
    })
    .catch(err => console.log(err));
};

exports.postCart = (req, res, next) => {
  const prodId = req.body.productId;
  Product.findById(prodId)
    .then(product => {
      return req.user.addToCart(product);
    })
    .then(result => {
      console.log(result);
      res.redirect('/cart');
    });
};

exports.postCartDeleteProduct = (req, res, next) => {
  const prodId = req.body.productId;
  req.user
    .removeFromCart(prodId)
    .then(result => {
      res.redirect('/cart');
    })
    .catch(err => console.log(err));
};

exports.getCheckout = (req,res,next) => {
  let products;
  let total = 0;
  req.user
    .populate('cart.items.productId')
    .execPopulate()
    .then(user => {
      products = user.cart.items;
      products.forEach(product => {
        total += product.quantity * product.productId.price
      })
       return stripe.checkout.sessions.create({
         payment_method_types:['card'],
         line_items:products.map(p=>{
           return {
             name : p.productId.title,
             description : p.productId.description,
             amount: p.productId.price * 100,
             currency : 'inr',
             quantity : p.quantity
           } 
         }),
         success_url: req.protocol + '://' + req.get('host') + '/checkout/success',
         cancel_url : req.protocol + '://' + req.get('host') + '/checkout/cancel' 
       })
    }).then(session => {
      res.render('shop/checkout', {
          path: '/checkout',
          pageTitle: 'Checkout',
          products: products,
          totalSum : total,
          sessionId : session.id
        }); 
      }
    )
    .catch(err => console.log(err));
}

exports.getCheckoutSuccess = (req,res,next) => {
  req.user
    .populate('cart.items.productId')
    .execPopulate()
    .then(user => {
      const products = user.cart.items.map(i => {
        return { quantity: i.quantity, product: { ...i.productId._doc } };
      });
      const order = new Order({
        user: {
          email: req.user.email,
          userId: req.user
        },
        products: products
      });
      return order.save();
    })
    .then(result => {
      return req.user.clearCart();
    })
    .then(() => {
      res.redirect('/orders');
    })
    .catch(err => console.log(err));
}
exports.postOrder = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .execPopulate()
    .then(user => {
      const products = user.cart.items.map(i => {
        return { quantity: i.quantity, product: { ...i.productId._doc } };
      });
      const order = new Order({
        user: {
          email: req.user.email,
          userId: req.user
        },
        products: products
      });
      return order.save();
    })
    .then(result => {
      return req.user.clearCart();
    })
    .then(() => {
      res.redirect('/orders');
    })
    .catch(err => console.log(err));
};

exports.getOrders = (req, res, next) => {
  Order.find({ 'user.userId': req.session.user._id })
    .then(orders => {
      res.render('shop/orders', {
        path: '/orders',
        pageTitle: 'Your Orders',
        orders: orders,
      });
    })
    .catch(err => console.log(err));
};

exports.getInvoice = (req,res,next) => {
  const orderId = req.params.orderId;
  Order.findById(orderId).then(order => {
    if(!order) {
      return next(new Error('No order found'))
    }
    if(order.user.userId.toString() !== req.user._id.toString()) {
      return next(new Error('Unauthorised user'))
    }
  const invoicename = 'invoice-' + orderId + '.pdf';   
  const invoicePath = path.join('data','invoices',invoicename);
  const pdfDoc = new PDFDocument(); 
  res.setHeader('Content-Type','application/pdf');
  res.setHeader('Content-Disposition','inline;filename="' + invoicename + '"');
  pdfDoc.pipe(fs.createWriteStream(invoicePath));
  pdfDoc.pipe(res);
 
  pdfDoc.fontSize(26).text('Invoice',{
    underline:true
  })
  pdfDoc.text('---------------------');
  let totalPrice = 0;
  order.products.forEach(prod => {
    totalPrice = totalPrice + prod.product.price * prod.quantity
    pdfDoc.fontSize(14).text(prod.product.title + ' - ' + prod.quantity + ' x ' + prod.product.price)
  })
  pdfDoc.text('---------------------');
  pdfDoc.fontSize(20).text('Total Price: ' + totalPrice);
  pdfDoc.end();
  // fs.readFile(invoicePath,(err,data)=>{
  //   if(err) {
  //    return next(err)
  //   }
  //   res.setHeader('Content-Type','application/pdf');
  //   res.setHeader('Content-Disposition','inline;filename="' + invoicename + '"');
  //   res.send(data);
  // })
  // const file = fs.createReadStream(invoicePath);
  // file.pipe(res);
  }).catch(err =>{
    next(err);
  })
}