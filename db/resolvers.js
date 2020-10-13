const Usuario = require('../models/usuario');
const Producto = require('../models/producto');
const Cliente = require('../models/cliente');
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
        obtenerUsuario:async (_, { token }) =>{
            const usuarioId = await jwt.verify(token, process.env.SECRETA) 
            return usuarioId
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

        nuevoCliente: async (_, {input} ) => {
            const { email } = input

            // verificar si el cliente ya está registrado
            const cliente = await Cliente.findOne({email});
            if (cliente){
                throw new Error ('El cliente ya está registrado');
            }

            const nuevoCliente = new Cliente(input);

            // asignarle un vendedor
            nuevoCliente.vendedor = "5f82097acd974934bc2cdae0";

            // guardarlo en la base de datos
            try {
                const resultado = await nuevoCliente.save();
                return resultado; 
            } catch (error) {
                console.log(error);
            }

        }
    } 
}

module.exports = resolvers;
