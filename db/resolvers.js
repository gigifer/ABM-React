const Usuario = require('../models/usuario');
const Producto = require('../models/producto');
const Cliente = require('../models/cliente');
const Pedido = require('../models/Pedido');

const bcryptjs = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: 'variables.env' });

const crearToken = (usuario, secreta, expiresIn) =>{
    const { id, email, nombre, apellido } = usuario;

    return jwt.sign({ id, nombre,apellido, email }, secreta, { expiresIn })
}

// Resolvers
const resolvers = {
    Query: {
        obtenerUsuario:async (_, {}, ctx) =>{
            return ctx.usuario;
        },

        obtenerProductos: async () => {
            try {
               const productos = await Producto.find({});
               return productos; 
            } catch (error) {
                console.log(error);
            }
        },

        obtenerProducto: async (_, {id}) =>{
            // revisar si el producto existe o no
            const producto = await Producto.findById(id);

            if (!producto){
                throw new Error ('Producto no encontrado')
            }
            return producto;
        },

        obtenerClientes: async () => {
            try {
                const clientes = await Cliente.find({});
                return clientes;
            } catch (error) {
                console.log(error);
            }
        },

        obtenerClientesVendedor: async (_, {}, ctx) =>{
            try {
                const clientes = await Cliente.find({ vendedor: ctx.usuario.id.toString() });
                return clientes;
            } catch (error) {
                console.log(error);
            }
        },

        obtenerCliente: async (_, {id}, ctx) =>{
            // revisar si el cliente existe o no
            const cliente = await Cliente.findById(id);
            if (!cliente){
                throw new Error ('Cliente no encontrado');
            }

            // quien lo creó puede verlo
            if(cliente.vendedor.toString() !== ctx.usuario.id){
                throw new Error ('No tienes las credenciales');
            }

            return cliente;
        },

        obtenerPedidos: async () => {
            try {
                const pedidos = await Pedido.find({});
                return pedidos;
            } catch (error) {
                console.log(error);
            }
        },

        obtenerPedidosVendedor: async (_, {}, ctx) =>{
            try {
                const pedidos = await Pedido.find({vendedor: ctx.usuario.id}).populate('cliente');
                return pedidos;
            } catch (error) {
                console.log(error);
            }
        },

        obtenerPedido: async (_, {id}, ctx) =>{
            // verificar si existe el pedido
            const pedido = await Pedido.findById(id);
            if (!pedido) {
                throw new Error ('Pedido no encontrado');
            }

            // solo puede verlo el vendedor creador
            if (pedido.vendedor.toString() !== ctx.usuario.id){
                throw new Error ('No tienes las credenciales');
            }

            // retornar el resultado
            return pedido;
        },

        obtenerPedidosEstado: async (_,  {estado}, ctx) =>{
            const pedidos = await Pedido.find({vendedor: ctx.usuario.id, estado});
            return pedidos;
        },

        mejoresClientes: async () =>{
            const clientes = await Pedido.aggregate([
                {$match: {estado: "COMPLETADO"}},
                {$group: {
                    _id: "$cliente",
                    total: {$sum: '$total'}
                }},
                {$lookup: {
                    from: 'clientes',
                    localField: '_id',
                    foreignField: '_id',
                    as: "cliente"
                }},
                {
                    $limit: 10
                },
                {
                    $sort: {total: -1}
                }
            ]);
            return clientes;
        },

        mejoresVendedores: async () =>{
            const vendedores = await Pedido.aggregate([
                {$match: {estado: "COMPLETADO"}},
                {$group: {
                    _id: "$vendedor",
                    total: {$sum: '$total'}
                }},
                {
                    $lookup: {
                        from: 'usuarios',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'vendedor'
                    }
                },
                {
                    $limit: 5
                },
                {
                    $sort: {total: -1}
                }
            ]);
            return vendedores;
        },

        buscarProducto: async (_, {texto}) =>{
            const productos = await Producto.find({ $text: { $search: texto}}).limit(10)
            return productos;
        }
    },
    Mutation: {
        nuevoUsuario:async (_, {input}) => {

            const { email, password } = input;

            // revisar si el usuario ya está registrado
            const existeUsuario = await Usuario.findOne({email});
            if (existeUsuario) {
                throw new Error('El usuario ya está registrado');
            }

            // hashear su password
            const salt = await bcryptjs.genSalt(10);
            input.password = await bcryptjs.hash(password, salt);

            try {
                // guardarlo en la base de datos
                const usuario = new Usuario(input);
                usuario.save(); //guardarlo
                return usuario;
            } catch (error) {
                console.log(error);
            }
            
        },
        autenticarUsuario: async (_, {input}) =>{
            const {email, password} = input;

            // verificar si existe usuario
            const existeUsuario = await Usuario.findOne({email});
            if (!existeUsuario) {
                throw new Error('El usuario no existe');
            }

            // comparar el password que ingresa el usuario con el de la base de datos
            const passwordCorrecto = await bcryptjs.compare(password, existeUsuario.password);

            if (!passwordCorrecto){
                throw new Error('El password es incorrecto');
            }

            // crear el token
            return {
                token: crearToken(existeUsuario, process.env.SECRETA, '24h')
            }
        },
        nuevoProducto: async (_, { input }) => {
            try{
                const producto = new Producto(input);

                // guardar en la base de datos
                const resultado = await producto.save();
                return resultado;
            }
            catch (error) {
                console.log(error);
            }

        },
    
        actualizarProducto: async (_, {id, input}) => {
            // revisar si el producto existe o no
            let producto = await Producto.findById(id);

            if (!producto){
                throw new Error ('Producto no encontrado');
            }

            // guardarlo en la base de datos actualizado
            producto = await Producto.findOneAndUpdate({_id: id}, input, {new: true});
            return producto;      
        },

        eliminarProducto: async (_, {id}) => {
            // revisar si el producto existe o no
            let producto = await Producto.findById(id);

            if (!producto){
                throw new Error ('Producto no encontrado');
            }

            // eliminar
            await Producto.findOneAndDelete({_id: id});
            return "Producto eliminado";
        },

        nuevoCliente: async (_, {input}, ctx ) => {
            console.log(ctx);
            const { email } = input

            // verificar si el cliente ya está registrado
            const cliente = await Cliente.findOne({email});
            if (cliente){
                throw new Error ('El cliente ya está registrado');
            }

            const nuevoCliente = new Cliente(input);

            // asignarle un vendedor
            nuevoCliente.vendedor = ctx.usuario.id;

            // guardarlo en la base de datos
            try {
                const resultado = await nuevoCliente.save();
                return resultado; 
            } catch (error) {
                console.log(error);
            }
        },

        actualizarCliente: async (_, {id, input}, ctx) =>{
            // verificar si existe el cliente
            let cliente = await Cliente.findById(id);

            if(!cliente){
                throw new Error('Ese cliente no existe');
            }

            // verificar si el vendedor es quien edita
            if(cliente.vendedor.toString() !== ctx.usuario.id){
                throw new Error ('No tienes las credenciales');
            }

            // guardar el cliente
            cliente = await Cliente.findOneAndUpdate({_id: id}, input, {new: true});
            return cliente;
        },

        eliminarCliente: async (_, {id}, ctx) =>{
            // verificar si existe el cliente
            let cliente = await Cliente.findById(id);

            if(!cliente){
                throw new Error('Ese cliente no existe');
            }

            // verificar si el vendedor es quien edita
            if(cliente.vendedor.toString() !== ctx.usuario.id){
                throw new Error ('No tienes las credenciales');
            }

            // eliminar el cliente
            await Cliente.findOneAndDelete({_id: id});
                return "Cliente eliminado";         
        },

        nuevoPedido: async (_, {input}, ctx) =>{
            const {cliente} = input

            // verificar si existe el cliente
            let clienteExiste = await Cliente.findById(cliente);

            if(!clienteExiste){
                throw new Error('Ese cliente no existe');
            }

            // verificar si el cliente es del vendedor
            if(clienteExiste.vendedor.toString() !== ctx.usuario.id){
                throw new Error ('No tienes las credenciales');
            }

            // revisar si el stock está disponible
            for await (const articulo of input.pedido){
                const {id} = articulo;

                const producto = await Producto.findById(id);
                if (articulo.cantidad > producto.existencia){
                    throw new Error (`El artículo ${producto.nombre} excede la cantidad disponible`);
                }else{
                    // restar la cantidad al disponible
                    producto.existencia = producto.existencia - articulo.cantidad;
                    await producto.save();
                }
            }

            // crear nuevo pedido
            const nuevoPedido = new Pedido(input); 

            // asignarle un vendedor
            nuevoPedido.vendedor = ctx.usuario.id;

            // guardarlo en la base de datos
            const resultado = await nuevoPedido.save();
            return resultado;
        },

        actualizarPedido: async (_, {id, input}, ctx) => {
            const {cliente} = input;

            // verificar si el pedido existe
            const existePedido = await Pedido.findById(id);
            if (!existePedido){
                throw new Error ('El pedido no existe');
            } 

            // verificar si el cliente existe
            const existeCliente = await Cliente.findById(cliente);
            if (!existeCliente){
                throw new Error ('El cliente no existe');
            } 

            // verificar si el pedido y el cliente son del vendedor
            if(existeCliente.vendedor.toString() !== ctx.usuario.id){
                throw new Error ('No tienes las credenciales');
            }

            // verificar el stock
            if (input.pedido){
                for await (const articulo of input.pedido){
                    const {id} = articulo;
    
                    const producto = await Producto.findById(id);
                    if (articulo.cantidad > producto.existencia){
                        throw new Error (`El artículo ${producto.nombre} excede la cantidad disponible`);
                    }else{
                        // restar la cantidad al disponible
                        producto.existencia = producto.existencia - articulo.cantidad;
                        await producto.save();
                    }
                }
            }

            // guardar el pedido
            const resultado = await Pedido.findOneAndUpdate({_id: id}, input, {new: true});
            return resultado;
        },

        eliminarPedido: async (_, {id}, ctx) =>{
            // verificar si existe el pedido
            const existePedido = await Pedido.findById(id);
            if(!existePedido){
                throw new Error('El pedido no existe');
            } 

            // verificar si el pedido es del vendedor
            if(existePedido.vendedor.toString() !== ctx.usuario.id){
                throw new Error ('No tienes las credenciales');
            }

            // eliminar el pedido
            await Pedido.findOneAndDelete({_id: id});
            return 'Pedido eliminado';
        }
    } 
}

module.exports = resolvers;
